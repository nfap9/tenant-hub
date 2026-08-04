import { tool } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import type { AnyTool, ToolContext } from '../tools/index.js';
import type { SystemPromptContext } from '../systemPrompt.js';

/** graph configurable 中传入的运行上下文 */
export interface GraphConfigurable {
  thread_id: string;
  toolCtx: ToolContext;
  promptCtx: SystemPromptContext;
  modelId?: string;
}

export const getGraphConfig = (config?: RunnableConfig): GraphConfigurable => {
  const c = config?.configurable as GraphConfigurable | undefined;
  if (!c?.toolCtx || !c?.thread_id || !c?.promptCtx) {
    throw new Error('缺少 graph 运行上下文（configurable）');
  }
  return c;
};

/**
 * 执行只读工具并把调用记录落库（AiToolCall 审计）。
 * 返回给 LLM 的文本摘要；所有失败（权限/参数/执行异常）都降级为文本，不抛出。
 */
export const executeReadTool = async (
  toolMeta: AnyTool,
  args: unknown,
  toolCtx: ToolContext,
  conversationId: string,
  toolCallId: string
): Promise<string> => {
  const parsed = toolMeta.inputSchema.safeParse(args);
  if (!parsed.success) {
    return `参数校验失败：${parsed.error.issues.map((i) => i.message).join('; ')}`;
  }
  const t0 = Date.now();
  try {
    const result = await toolMeta.execute(parsed.data, toolCtx);
    await prisma.aiToolCall
      .create({
        data: {
          conversationId,
          toolCallId,
          toolName: toolMeta.name,
          input: parsed.data as never,
          output: (result.data ?? result.summary) as never,
          status: result.ok ? 'SUCCESS' : 'FAILED',
          errorMessage: result.error,
          durationMs: Date.now() - t0,
          isWrite: toolMeta.isWrite,
        },
      })
      .catch(() => undefined);
    return result.summary;
  } catch (err) {
    const message = err instanceof Error ? err.message : '工具执行异常';
    await prisma.aiToolCall
      .create({
        data: {
          conversationId,
          toolCallId,
          toolName: toolMeta.name,
          input: parsed.data as never,
          output: Prisma.JsonNull,
          status: 'FAILED',
          errorMessage: message,
          durationMs: Date.now() - t0,
          isWrite: toolMeta.isWrite,
        },
      })
      .catch(() => undefined);
    return `工具执行失败：${message}`;
  }
};

/**
 * 把 ToolMeta 转成 LangChain StructuredTool，供 bindTools 使用（name/description/zod schema 直接来自 ToolMeta）。
 * 注意：实际执行由 graph 的 tools 节点拦截驱动，这里的 func 只是兜底——
 * 读工具 func 内做 execute + 审计；写工具 func 返回占位文本（不会真正执行写操作）。
 */
export const toLangChainTool = (toolMeta: AnyTool) =>
  tool(
    async (input, config) => {
      if (toolMeta.isWrite) {
        return `写操作 ${toolMeta.name} 需要用户确认后才能执行`;
      }
      const c = config?.configurable as
        | (Partial<GraphConfigurable> & { tool_call_id?: string })
        | undefined;
      if (!c?.toolCtx) return '缺少工具运行上下文';
      return executeReadTool(
        toolMeta,
        input,
        c.toolCtx,
        c.thread_id ?? '',
        c.tool_call_id ?? ''
      );
    },
    {
      name: toolMeta.name,
      description: toolMeta.description,
      schema: toolMeta.inputSchema as never,
    }
  );
