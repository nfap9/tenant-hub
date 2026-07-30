import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { createPendingAction } from '../storage/pendingActionRecords.js';
import { findTool } from '../tools/index.js';
import type { ToolContext } from '../tools/index.js';
import type { PendingActionEvent } from './events.js';

interface ToolCallInput {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * 执行只读工具调用，并把调用记录落库（AiToolCall）。
 * 返回给 LLM 的文本摘要；所有失败（不存在/权限/参数/执行异常）都降级为文本，不抛出。
 */
export const runReadToolCall = async (
  call: ToolCallInput,
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

/**
 * 写工具不直接执行：生成 preview + 落库 AiPendingAction，等待用户确认。
 * 返回给 LLM 的文本摘要和（成功时的）pending 事件载荷。
 */
export const createPendingForWriteTool = async (
  call: ToolCallInput,
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
