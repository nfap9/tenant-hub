import { Command, GraphRecursionError } from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import type { AIMessageChunk, BaseMessage } from '@langchain/core/messages';
import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../utils/http.js';
import { ensureConversationOwnership } from '../storage/conversations.js';
import { selectToolsForUser } from '../tools/index.js';
import { getGraph } from './graph.js';
import type { GraphConfigurable } from './tools.js';
import {
  messageContentToText,
  type AgentContext,
  type AgentEvent,
  type PendingActionPayload,
} from './events.js';

const RECURSION_LIMIT = 16;

const buildConfigurable = (
  conversationId: string,
  modelId: string | undefined,
  ctx: AgentContext
): GraphConfigurable => ({
  thread_id: conversationId,
  modelId,
  toolCtx: {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    permissions: ctx.permissions,
    prisma,
  },
  promptCtx: {
    orgName: ctx.orgName,
    username: ctx.username,
    roleName: ctx.roleName,
    today: new Date().toISOString().slice(0, 10),
    toolNames: selectToolsForUser(ctx.permissions).map((t) => t.name),
  },
});

const toErrorMessage = (err: unknown): string => {
  if (err instanceof GraphRecursionError) return '达到最大迭代次数';
  if (err instanceof HttpError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Agent 执行失败';
};

interface StreamParams {
  conversationId: string;
  modelId?: string;
  ctx: AgentContext;
  input: { messages: BaseMessage[] } | Command;
  onEvent: (e: AgentEvent) => void;
  signal?: AbortSignal;
  /** LangSmith trace 名称（chat / resume） */
  runName: string;
}

/** 跑 graph stream 并把 chunk 翻译成 SSE 事件 */
const streamGraph = async (params: StreamParams): Promise<void> => {
  const { ctx, onEvent } = params;
  const graph = await getGraph();
  const stream = await graph.stream(params.input as never, {
    configurable: buildConfigurable(
      params.conversationId,
      params.modelId,
      ctx
    ) as unknown as Record<string, unknown>,
    recursionLimit: RECURSION_LIMIT,
    streamMode: ['messages', 'custom'],
    signal: params.signal,
    // LangSmith trace 元数据：未配置 LANGSMITH_* 环境变量时不影响任何行为
    runName: params.runName,
    tags: ['tenant-hub', params.runName],
    metadata: {
      conversationId: params.conversationId,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      modelId: params.modelId ?? null,
    },
  });

  for await (const [mode, chunk] of stream) {
    if (mode === 'messages') {
      const [msg, metadata] = chunk as [
        AIMessageChunk,
        { langgraph_node?: string },
      ];
      // 只转发 agent 节点的模型流
      if (metadata?.langgraph_node !== 'agent') continue;
      const delta = messageContentToText(msg.content);
      if (delta) onEvent({ type: 'text_delta', delta });
    } else if (mode === 'custom') {
      // 节点内 writer 发出的 tool_call / interrupt / message 事件，直接透传
      onEvent(chunk as AgentEvent);
    }
  }
};

/**
 * 发送用户消息并流式运行 graph。
 * 正常结束发 done（含 interrupt 暂停）；异常发 error。
 */
export const runGraphChat = async (params: {
  conversationId: string;
  userMessage: string;
  modelId?: string;
  ctx: AgentContext;
  onEvent: (e: AgentEvent) => void;
  signal?: AbortSignal;
}): Promise<void> => {
  const { conversationId, userMessage, ctx, onEvent } = params;
  try {
    const conv = await ensureConversationOwnership(
      conversationId,
      ctx.organizationId,
      ctx.userId
    );
    // 沿用原 appendUserMessage 的单 update 语义；空标题用首条消息前 30 字
    await prisma.aiConversation.update({
      where: { id: conversationId },
      data: {
        updatedAt: new Date(),
        ...(conv.title ? {} : { title: userMessage.slice(0, 30) }),
      },
    });

    await streamGraph({
      conversationId,
      modelId: params.modelId ?? conv.modelId,
      ctx,
      input: { messages: [new HumanMessage(userMessage)] },
      onEvent,
      signal: params.signal,
      runName: 'ai-chat',
    });
    onEvent({ type: 'done' });
  } catch (err) {
    onEvent({ type: 'error', message: toErrorMessage(err) });
  }
};

/**
 * 恢复 interrupt：用户对待确认操作 approve / reject 后，图从暂停处继续执行。
 * 事件协议与 runGraphChat 相同。
 */
export const runGraphResume = async (params: {
  conversationId: string;
  actionId: string;
  decision: 'approve' | 'reject';
  ctx: AgentContext;
  onEvent: (e: AgentEvent) => void;
  signal?: AbortSignal;
}): Promise<void> => {
  const { conversationId, actionId, ctx, onEvent } = params;
  try {
    const conv = await ensureConversationOwnership(
      conversationId,
      ctx.organizationId,
      ctx.userId
    );

    const graph = await getGraph();
    const state = await graph.getState({
      configurable: { thread_id: conversationId },
    });
    const pending = state.tasks.flatMap((t) =>
      (t.interrupts ?? []).map((i) => i.value as PendingActionPayload)
    );
    if (!pending.some((p) => p.id === actionId)) {
      throw new HttpError(400, '待确认操作不存在或已处理');
    }

    await prisma.aiConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    await streamGraph({
      conversationId,
      modelId: conv.modelId,
      ctx,
      input: new Command({ resume: { decision: params.decision } }),
      onEvent,
      signal: params.signal,
      runName: 'ai-resume',
    });
    onEvent({ type: 'done' });
  } catch (err) {
    onEvent({ type: 'error', message: toErrorMessage(err) });
  }
};
