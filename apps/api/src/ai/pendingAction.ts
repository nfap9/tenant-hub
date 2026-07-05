import { prisma } from '../config/prisma.js';
import { HttpError } from '../utils/http.js';
import { findTool } from './tools/index.js';
import type { ToolContext } from './tools/index.js';
import {
  appendUserMessage,
  getPendingActionForOrg,
  markPendingAction,
} from './storage.js';

export interface ConfirmActionResult {
  actionId: string;
  toolName: string;
  ok: boolean;
  summary: string;
  data?: unknown;
}

/**
 * 确认并执行一个待确认操作。重新校验权限、参数；调用 tool.execute 真正落库。
 * 执行成功后把工具结果作为 TOOL 消息追加到会话，便于后续多轮对话引用。
 */
export const confirmPendingAction = async (params: {
  actionId: string;
  organizationId: string;
  userId: string;
  permissions: string[];
}): Promise<ConfirmActionResult> => {
  const { actionId, organizationId, userId, permissions } = params;
  const action = await getPendingActionForOrg(actionId, organizationId);
  if (!action) throw new HttpError(404, '待确认操作不存在');
  if (action.status !== 'PENDING') {
    throw new HttpError(
      400,
      `该待确认操作当前状态为 ${action.status}，无法处理`
    );
  }
  if (action.expiresAt.getTime() < Date.now()) {
    throw new HttpError(400, '该待确认操作已过期');
  }

  const tool = findTool(action.toolName);
  if (!tool) throw new HttpError(400, `工具不存在：${action.toolName}`);
  if (tool.permission && !permissions.includes('*')) {
    if (!permissions.includes(tool.permission)) {
      throw new HttpError(403, `无权执行 ${action.toolName}`);
    }
  }

  const parsed = tool.inputSchema.safeParse(action.input);
  if (!parsed.success) {
    throw new HttpError(
      400,
      `参数校验失败：${parsed.error.issues.map((i) => i.message).join('; ')}`
    );
  }

  const toolCtx: ToolContext = {
    organizationId,
    userId,
    permissions,
    prisma,
  };

  let ok = true;
  let summary: string;
  let data: unknown;
  try {
    const result = await tool.execute(parsed.data, toolCtx);
    ok = result.ok;
    summary = result.summary;
    data = result.data;
    if (!result.ok && result.error) {
      summary = `${summary}\n错误：${result.error}`;
    }
  } catch (err) {
    ok = false;
    summary = `工具执行失败：${err instanceof Error ? err.message : '未知错误'}`;
  }

  // 标记为 CONFIRMED（即使执行失败也标记，避免重复确认；失败信息已写入 summary）
  await markPendingAction(actionId, 'CONFIRMED', organizationId, userId);
  await appendUserMessage(
    action.conversationId,
    `[系统] 已执行 ${action.toolName}，结果：${summary}`
  );

  return { actionId, toolName: action.toolName, ok, summary, data };
};

export const rejectPendingAction = async (params: {
  actionId: string;
  organizationId: string;
  userId: string;
}): Promise<void> => {
  const { actionId, organizationId, userId } = params;
  const action = await getPendingActionForOrg(actionId, organizationId);
  if (!action) throw new HttpError(404, '待确认操作不存在');
  await markPendingAction(actionId, 'REJECTED', organizationId, userId);
  await appendUserMessage(
    action.conversationId,
    `[系统] 用户已拒绝 ${action.toolName}，该操作未执行。`
  );
};
