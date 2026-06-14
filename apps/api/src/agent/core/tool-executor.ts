import { ToolMessage } from '@langchain/core/messages';
import type { StructuredTool } from '@langchain/core/tools';
import { getToolLabel, getToolPermission } from './tool-registry.js';
import type { AgentContext } from '../types.js';

export interface ToolCallLike {
  id?: string;
  name?: string;
  args?: string | Record<string, unknown>;
}

export interface ToolExecutionResult {
  toolMessage: ToolMessage;
  resultText: string;
}

function parseArgs(
  args?: string | Record<string, unknown>
): Record<string, unknown> {
  if (typeof args === 'string') {
    try {
      return JSON.parse(args) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return (args || {}) as Record<string, unknown>;
}

export async function executeToolCall(
  toolCall: ToolCallLike,
  tools: StructuredTool[],
  ctx: AgentContext
): Promise<ToolExecutionResult> {
  const toolName = toolCall.name || '';
  const toolArgs = parseArgs(toolCall.args);
  const toolCallId = (toolCall.id || toolName) as string;

  const tool = tools.find((t) => t.name === toolName);
  if (!tool) {
    const error = { error: `工具 ${toolName} 不存在` };
    return {
      toolMessage: new ToolMessage({
        content: JSON.stringify(error),
        tool_call_id: toolCallId,
      }),
      resultText: JSON.stringify(error),
    };
  }

  const requiredPermission = getToolPermission(toolName);
  if (
    requiredPermission &&
    !ctx.permissions.includes('*') &&
    !ctx.permissions.includes(requiredPermission)
  ) {
    const error = {
      error: `无权限使用${getToolLabel(toolName)}功能`,
    };
    return {
      toolMessage: new ToolMessage({
        content: JSON.stringify(error),
        tool_call_id: toolCallId,
      }),
      resultText: JSON.stringify(error),
    };
  }

  try {
    const result = await tool.invoke(toolArgs);
    const resultText = String(result);
    return {
      toolMessage: new ToolMessage({
        content: resultText,
        tool_call_id: toolCallId,
      }),
      resultText,
    };
  } catch (error) {
    const errorPayload = {
      error: error instanceof Error ? error.message : '工具执行失败',
    };
    return {
      toolMessage: new ToolMessage({
        content: JSON.stringify(errorPayload),
        tool_call_id: toolCallId,
      }),
      resultText: JSON.stringify(errorPayload),
    };
  }
}
