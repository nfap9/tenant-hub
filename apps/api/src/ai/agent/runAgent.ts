import { prisma } from '../../config/prisma.js';
import type { ChatMessage, ToolDefinition } from '../llm/types.js';
import {
  appendAssistantMessage,
  appendToolMessage,
  appendUserMessage,
  historyToChatMessages,
  listMessages,
} from '../storage/messages.js';
import { ensureConversationOwnership } from '../storage/conversations.js';
import { buildSystemPromptForTools } from '../systemPrompt.js';
import { recordUsage } from '../usage.js';
import {
  findTool,
  selectToolsForUser,
  toToolDefinition,
} from '../tools/index.js';
import type { ToolContext } from '../tools/index.js';
import { chatWithFallback, resolveModelChain } from './modelChain.js';
import { createPendingForWriteTool, runReadToolCall } from './toolRunner.js';
import type { RunAgentParams } from './events.js';

const MAX_ITERATIONS = 8;

/**
 * Agent 主循环：拼装上下文 → 调模型 → 处理工具调用 → 回灌结果，直至模型不再调用工具。
 * 通过 onEvent 以 SSE 事件向外推送进度。
 */
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
