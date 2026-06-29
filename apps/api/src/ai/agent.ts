import { env } from '../config/env.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import type { ModelConfig } from './models.config.js';
import { findModel } from './models.config.js';
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
} from './storage.js';
import { buildSystemPromptForTools } from './systemPrompt.js';
import { recordUsage } from './usage.js';
import {
  findTool,
  selectToolsForUser,
  toToolDefinition,
} from './tools/index.js';
import type { ToolContext } from './tools/index.js';

export interface AgentContext {
  organizationId: string;
  userId: string;
  permissions: string[];
  orgName: string;
  username: string;
  roleName: string;
}

export type AgentEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'assistant_message'; text: string }
  | { type: 'tool_call'; name: string; summary: string }
  | { type: 'pending_action'; action: unknown }
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

const MODEL_PREFERENCE = [
  'claude-sonnet-4-6',
  'gpt-4o',
  'deepseek-chat',
  'claude-haiku-4-5',
  'qwen-plus',
  'moonshot-v1-8k',
];

const resolveDefault = (): ModelConfig | undefined => {
  const explicit = findModel(env.AI_DEFAULT_MODEL_ID);
  if (explicit?.enabled) return explicit;
  return MODEL_PREFERENCE.map((id) => findModel(id)).find(
    (m): m is ModelConfig => !!m && m.enabled
  );
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

const runToolCall = async (
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

  const maxIterations = env.AI_MAX_ITERATIONS;

  try {
    for (let i = 0; i < maxIterations; i++) {
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
        onEvent({ type: 'tool_call', name: call.name, summary: '' });
        const summary = await runToolCall(call, toolCtx, assistantDbMessage.id);
        onEvent({ type: 'tool_call', name: call.name, summary });
        await appendToolMessage(conversationId, call.id, summary);
        messages.push({
          role: 'tool',
          toolCallId: call.id,
          content: summary,
        });
      }
    }
    onEvent({ type: 'error', message: '达到最大迭代次数' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Agent 执行失败';
    onEvent({ type: 'error', message });
  }
};
