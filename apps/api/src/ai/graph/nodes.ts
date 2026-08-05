import {
  AIMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import {
  getWriter,
  interrupt,
  type LangGraphRunnableConfig,
} from '@langchain/langgraph';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { buildSystemPrompt } from '../systemPrompt.js';
import { recordUsage } from '../usage.js';
import { findTool, selectToolsForUser } from '../tools/index.js';
import type { AnyTool, ToolContext } from '../tools/index.js';
import {
  createPendingAction,
  findPendingActionByToolCallId,
  markPendingAction,
  type PendingActionRecord,
} from '../storage/pendingActionRecords.js';
import { buildModelChain } from './chatModel.js';
import { executeReadTool, getGraphConfig, toLangChainTool } from './tools.js';
import { serializeMessage, type PendingActionPayload } from './events.js';

type GraphState = { messages: BaseMessage[] };

interface ModelToolCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
}

/**
 * agent 节点：拼装系统提示 + 历史消息调模型。
 * 有 usage_metadata 时记账（失败吞掉），产出消息后通过 writer 发 message 事件。
 */
export const agentNode = async (
  state: GraphState,
  config?: LangGraphRunnableConfig
): Promise<GraphState> => {
  const { toolCtx, promptCtx, modelId } = getGraphConfig(config);
  const tools = selectToolsForUser(toolCtx.permissions);
  const { runnable, primary } = await buildModelChain(
    modelId,
    tools.map(toLangChainTool)
  );

  const response = await runnable.invoke(
    [new SystemMessage(buildSystemPrompt(promptCtx)), ...state.messages],
    config
  );

  const usage = response.usage_metadata;
  if (usage) {
    await recordUsage({
      organizationId: toolCtx.organizationId,
      userId: toolCtx.userId,
      model: primary,
      usage: {
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
      },
    }).catch(() => undefined);
  }

  const message = response as unknown as AIMessage;
  getWriter()?.({ type: 'message', message: serializeMessage(message) });
  return { messages: [message] };
};

const toPayload = (record: PendingActionRecord): PendingActionPayload => ({
  id: record.id,
  conversationId: record.conversationId,
  toolCallId: record.toolCallId,
  toolName: record.toolName,
  summary: record.summary,
  expiresAt: record.expiresAt.toISOString(),
});

/**
 * 写工具 preview + 落库 AiPendingAction。
 * interrupt 恢复后节点会从头重跑，toolCallId 已有记录则直接复用，避免重复落库。
 * 返回 interrupt 载荷；失败时返回错误文本。
 */
const ensurePendingPayload = async (
  toolMeta: AnyTool,
  input: unknown,
  toolCtx: ToolContext,
  conversationId: string,
  toolCallId: string
): Promise<PendingActionPayload | string> => {
  if (!toolMeta.preview) {
    return `工具 ${toolMeta.name} 未提供 preview，无法生成待确认操作`;
  }
  try {
    const existing = await findPendingActionByToolCallId(toolCallId);
    if (existing) return toPayload(existing);
    const preview = await toolMeta.preview(input, toolCtx);
    const record = await createPendingAction({
      conversationId,
      toolCallId,
      toolName: toolMeta.name,
      input,
      summary: preview,
    });
    return toPayload(record);
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return `生成待确认操作失败：${message}`;
  }
};

/** 写工具的 AiToolCall 审计（失败吞掉，不影响主流程） */
const auditWriteCall = async (data: {
  conversationId: string;
  toolCallId: string;
  toolName: string;
  input: unknown;
  output?: unknown;
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  durationMs?: number;
  confirmedById?: string;
}): Promise<void> => {
  await prisma.aiToolCall
    .create({
      data: {
        conversationId: data.conversationId,
        toolCallId: data.toolCallId,
        toolName: data.toolName,
        input: data.input as never,
        output: (data.output ?? Prisma.JsonNull) as never,
        status: data.status,
        errorMessage: data.errorMessage,
        durationMs: data.durationMs,
        isWrite: true,
        confirmedById: data.confirmedById,
        confirmedAt: data.confirmedById ? new Date() : undefined,
      },
    })
    .catch(() => undefined);
};

/** 用户批准：真正执行写工具。沿用旧语义——执行失败也标记 CONFIRMED，避免重复确认 */
const approveWrite = async (
  toolMeta: AnyTool,
  input: unknown,
  payload: PendingActionPayload,
  toolCtx: ToolContext
): Promise<string> => {
  if (new Date(payload.expiresAt).getTime() < Date.now()) {
    return '该待确认操作已过期，未执行';
  }
  const t0 = Date.now();
  let ok = true;
  let summary: string;
  let output: unknown;
  try {
    const result = await toolMeta.execute(input, toolCtx);
    ok = result.ok;
    summary = result.summary;
    output = result.data ?? result.summary;
    if (!result.ok && result.error) {
      summary = `${summary}\n错误：${result.error}`;
    }
  } catch (err) {
    ok = false;
    summary = `工具执行失败：${err instanceof Error ? err.message : '未知错误'}`;
  }
  await markPendingAction(
    payload.id,
    'CONFIRMED',
    toolCtx.organizationId,
    toolCtx.userId
  ).catch(() => undefined);
  await auditWriteCall({
    conversationId: payload.conversationId,
    toolCallId: payload.toolCallId,
    toolName: toolMeta.name,
    input,
    output,
    status: ok ? 'SUCCESS' : 'FAILED',
    errorMessage: ok ? undefined : summary,
    durationMs: Date.now() - t0,
    confirmedById: toolCtx.userId,
  });
  return summary;
};

/** 用户拒绝：标记 REJECTED，不执行 */
const rejectWrite = async (
  toolMeta: AnyTool,
  input: unknown,
  payload: PendingActionPayload,
  toolCtx: ToolContext
): Promise<string> => {
  await markPendingAction(
    payload.id,
    'REJECTED',
    toolCtx.organizationId,
    toolCtx.userId
  ).catch(() => undefined);
  await auditWriteCall({
    conversationId: payload.conversationId,
    toolCallId: payload.toolCallId,
    toolName: toolMeta.name,
    input,
    status: 'FAILED',
    errorMessage: '用户已拒绝该操作',
  });
  return '用户已拒绝该操作，未执行';
};

/** 处理单个工具调用，返回给 LLM 的文本。所有失败降级为文本，不抛出 */
const runOneToolCall = async (
  call: ModelToolCall,
  toolCtx: ToolContext,
  conversationId: string,
  writer: ((chunk: unknown) => void) | undefined
): Promise<string> => {
  const toolMeta = findTool(call.name);
  if (!toolMeta) return `工具不存在：${call.name}`;
  if (toolMeta.permission && !toolCtx.permissions.includes('*')) {
    if (!toolCtx.permissions.includes(toolMeta.permission)) {
      return `权限不足：调用 ${call.name} 需要 ${toolMeta.permission}`;
    }
  }
  const parsed = toolMeta.inputSchema.safeParse(call.args);
  if (!parsed.success) {
    return `参数校验失败：${parsed.error.issues.map((i) => i.message).join('; ')}`;
  }

  if (!toolMeta.isWrite) {
    // 保持旧协议节奏：开始前发空摘要一次，完成后发结果摘要一次
    writer?.({ type: 'tool_call', name: call.name, summary: '' });
    const summary = await executeReadTool(
      toolMeta,
      parsed.data,
      toolCtx,
      conversationId,
      call.id ?? ''
    );
    writer?.({ type: 'tool_call', name: call.name, summary });
    return summary;
  }

  const payloadOrError = await ensurePendingPayload(
    toolMeta,
    parsed.data,
    toolCtx,
    conversationId,
    call.id ?? ''
  );
  if (typeof payloadOrError === 'string') return payloadOrError;

  writer?.({ type: 'interrupt', action: payloadOrError });
  const resume = interrupt(payloadOrError) as
    | { decision?: 'approve' | 'reject' }
    | undefined;
  if (resume?.decision === 'approve') {
    return approveWrite(toolMeta, parsed.data, payloadOrError, toolCtx);
  }
  return rejectWrite(toolMeta, parsed.data, payloadOrError, toolCtx);
};

/**
 * tools 节点：顺序处理最后一条 AIMessage 的 tool_calls。
 * 读工具直接执行；写工具生成待确认操作后 interrupt 等待用户 approve/reject。
 */
export const toolsNode = async (
  state: GraphState,
  config?: LangGraphRunnableConfig
): Promise<GraphState> => {
  const writer = getWriter();
  const { toolCtx, thread_id: conversationId } = getGraphConfig(config);
  const last = state.messages[state.messages.length - 1];
  const calls = last instanceof AIMessage ? (last.tool_calls ?? []) : [];

  const results: ToolMessage[] = [];
  for (const call of calls) {
    const content = await runOneToolCall(call, toolCtx, conversationId, writer);
    results.push(
      new ToolMessage({
        content,
        tool_call_id: call.id ?? '',
        name: call.name,
      })
    );
  }
  for (const m of results) {
    writer?.({ type: 'message', message: serializeMessage(m) });
  }
  return { messages: results };
};
