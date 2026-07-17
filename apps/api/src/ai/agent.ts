import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import type { ModelConfig } from './models.config.js';
import { findModel, resolveDefaultModel } from './models.config.js';
import { getProvider } from './providers/index.js';
import type {
  ChatMessage,
  ChatRequest,
  ChatResult,
  ToolDefinition,
} from './types.js';
import {
  appendAssistantMessage,
  appendToolMessage,
  appendUserMessage,
  ensureConversationOwnership,
  historyToChatMessages,
  listMessages,
  createPendingAction,
} from './storage.js';
import { buildSystemPromptForTools } from './systemPrompt.js';
import { recordUsage } from './usage.js';
import {
  findTool,
  selectToolsForUser,
  toToolDefinition,
} from './tools/index.js';
import type { ToolContext, ToolPreview } from './tools/index.js';

export interface AgentContext {
  organizationId: string;
  userId: string;
  permissions: string[];
  orgName: string;
  username: string;
  roleName: string;
}

export interface PendingActionEvent {
  id: string;
  conversationId: string;
  toolCallId: string;
  toolName: string;
  summary: ToolPreview;
  expiresAt: string;
}

export type AgentEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'assistant_message'; text: string }
  | { type: 'tool_call'; name: string; summary: string }
  | { type: 'pending_action'; action: PendingActionEvent }
  | { type: 'error'; message: string }
  | { type: 'done' };

export interface RunAgentParams {
  conversationId: string;
  organizationId: string;
  userId: string;
  userMessage: string;
  modelId?: string;
  ctx: AgentContext;
  onEvent: (e: AgentEvent) => void;
  signal?: AbortSignal;
}

const resolveDefault = (): ModelConfig => {
  return resolveDefaultModel();
};

const resolveModelChain = (modelId?: string): ModelConfig[] => {
  const primary = (modelId && findModel(modelId)) || resolveDefault();
  if (!primary) throw new Error('无可用的 AI 模型');
  const chain = [primary];
  for (const id of primary.fallbackTo ?? []) {
    const m = findModel(id);
    if (m && m.enabled && !chain.includes(m)) chain.push(m);
  }
  return chain;
};

const chatOnce = async (
  model: ModelConfig,
  req: ChatRequest
): Promise<ChatResult> => {
  const provider = getProvider(model);
  return provider.chat({
    ...req,
    model: model.providerModel,
    temperature: req.temperature ?? model.temperature,
    maxTokens: req.maxTokens ?? model.maxTokens,
  });
};

const chatWithFallback = async (
  chain: ModelConfig[],
  req: ChatRequest
): Promise<{ result: ChatResult; model: ModelConfig }> => {
  let lastError: unknown;
  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    try {
      const result = await chatOnce(model, req);
      return { result, model };
    } catch (err) {
      lastError = err;
      if (i === chain.length - 1) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('模型调用失败');
};

const runReadToolCall = async (
  call: { id: string; name: string; arguments: Record<string, unknown> },
  toolCtx: ToolContext,
  messageId: string
): Promise<string> => {
  const tool = findTool(call.name);
  if (!tool) return `工具不存在：${call.name}`;
  if (tool.permission && !toolCtx.permissions.includes('*')) {
    if (!toolCtx.permissions.includes(tool.permission)) {
      return `权限不足：调用 ${call.name} 需要 ${tool.permission}`;
    }
  }
  const parsed = tool.inputSchema.safeParse(call.arguments);
  if (!parsed.success) {
    return `参数校验失败：${parsed.error.issues.map((i) => i.message).join('; ')}`;
  }
  const t0 = Date.now();
  try {
    const result = await tool.execute(parsed.data, toolCtx);
    await prisma.aiToolCall.create({
      data: {
        messageId,
        toolName: call.name,
        input: parsed.data as never,
        output: (result.data ?? result.summary) as never,
        status: result.ok ? 'SUCCESS' : 'FAILED',
        errorMessage: result.error,
        durationMs: Date.now() - t0,
        isWrite: tool.isWrite,
      },
    });
    return result.summary;
  } catch (err) {
    const message = err instanceof Error ? err.message : '工具执行异常';
    await prisma.aiToolCall.create({
      data: {
        messageId,
        toolName: call.name,
        input: parsed.data as never,
        output: Prisma.JsonNull,
        status: 'FAILED',
        errorMessage: message,
        durationMs: Date.now() - t0,
        isWrite: tool.isWrite,
      },
    });
    return `工具执行失败：${message}`;
  }
};

const createPendingForWriteTool = async (
  call: { id: string; name: string; arguments: Record<string, unknown> },
  toolCtx: ToolContext,
  conversationId: string
): Promise<{ summary: string; pending: PendingActionEvent | null }> => {
  const tool = findTool(call.name);
  if (!tool) return { summary: `工具不存在：${call.name}`, pending: null };
  if (tool.permission && !toolCtx.permissions.includes('*')) {
    if (!toolCtx.permissions.includes(tool.permission)) {
      return {
        summary: `权限不足：调用 ${call.name} 需要 ${tool.permission}`,
        pending: null,
      };
    }
  }
  if (!tool.preview) {
    return {
      summary: `工具 ${call.name} 未提供 preview，无法生成待确认操作`,
      pending: null,
    };
  }
  const parsed = tool.inputSchema.safeParse(call.arguments);
  if (!parsed.success) {
    return {
      summary: `参数校验失败：${parsed.error.issues.map((i) => i.message).join('; ')}`,
      pending: null,
    };
  }
  try {
    const preview = await tool.preview(parsed.data, toolCtx);
    const record = await createPendingAction({
      conversationId,
      toolCallId: call.id,
      toolName: call.name,
      input: parsed.data,
      summary: preview,
    });
    return {
      summary: `已生成待确认操作（${preview.title}），等待用户在前端确认后执行。actionId=${record.id}`,
      pending: {
        id: record.id,
        conversationId: record.conversationId,
        toolCallId: record.toolCallId,
        toolName: record.toolName,
        summary: record.summary,
        expiresAt: record.expiresAt.toISOString(),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : '生成待确认操作失败';
    return { summary: `生成待确认操作失败：${message}`, pending: null };
  }
};

export const runAgent = async (params: RunAgentParams): Promise<void> => {
  const { conversationId, ctx, userMessage, onEvent, signal } = params;

  await ensureConversationOwnership(
    conversationId,
    ctx.organizationId,
    ctx.userId
  );
  await appendUserMessage(conversationId, userMessage);

  const history = await listMessages(conversationId);
  const historyMessages = historyToChatMessages(history);

  const tools = selectToolsForUser(ctx.permissions);
  const toolDefs: ToolDefinition[] = tools.map(toToolDefinition);

  const systemPrompt = buildSystemPromptForTools(
    {
      orgName: ctx.orgName,
      username: ctx.username,
      roleName: ctx.roleName,
      today: new Date().toISOString().slice(0, 10),
      toolNames: tools.map((t) => t.name),
    },
    toolDefs
  );

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
  ];

  const chain = resolveModelChain(params.modelId);
  const toolCtx: ToolContext = {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    permissions: ctx.permissions,
    prisma,
  };

  const MAX_ITERATIONS = 8;

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const { result, model } = await chatWithFallback(chain, {
        model: '',
        messages,
        tools: toolDefs,
        signal,
      });

      if (result.usage) {
        await recordUsage({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          model,
          usage: result.usage,
        }).catch(() => undefined);
      }

      const hasToolCalls = result.toolCalls.length > 0;
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: result.content,
        toolCalls: hasToolCalls ? result.toolCalls : undefined,
      };
      messages.push(assistantMsg);

      const assistantDbMessage = await appendAssistantMessage(conversationId, {
        content: result.content,
        toolCalls: hasToolCalls ? result.toolCalls : undefined,
        modelId: model.id,
        tokensInput: result.usage.inputTokens,
        tokensOutput: result.usage.outputTokens,
      });

      if (result.content) {
        onEvent({ type: 'assistant_message', text: result.content });
      }

      if (!hasToolCalls) {
        onEvent({ type: 'done' });
        return;
      }

      for (const call of result.toolCalls) {
        const tool = findTool(call.name);
        if (tool?.isWrite) {
          onEvent({
            type: 'tool_call',
            name: call.name,
            summary: '生成待确认操作…',
          });
          const { summary, pending } = await createPendingForWriteTool(
            call,
            toolCtx,
            conversationId
          );
          if (pending) onEvent({ type: 'pending_action', action: pending });
          onEvent({ type: 'tool_call', name: call.name, summary });
          await appendToolMessage(conversationId, call.id, summary);
          messages.push({
            role: 'tool',
            toolCallId: call.id,
            content: summary,
          });
        } else {
          onEvent({ type: 'tool_call', name: call.name, summary: '' });
          const summary = await runReadToolCall(
            call,
            toolCtx,
            assistantDbMessage.id
          );
          onEvent({ type: 'tool_call', name: call.name, summary });
          await appendToolMessage(conversationId, call.id, summary);
          messages.push({
            role: 'tool',
            toolCallId: call.id,
            content: summary,
          });
        }
      }
    }
    onEvent({ type: 'error', message: '达到最大迭代次数' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Agent 执行失败';
    onEvent({ type: 'error', message });
  }
};
