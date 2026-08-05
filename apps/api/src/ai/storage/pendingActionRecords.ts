import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../utils/http.js';
import type { ToolPreview } from '../tools/types.js';

export interface PendingActionRecord {
  id: string;
  conversationId: string;
  toolCallId: string;
  toolName: string;
  input: unknown;
  summary: ToolPreview;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED';
  expiresAt: Date;
  createdAt?: Date;
}

const PENDING_ACTION_TTL_MIN = 10;

const pendingTtlMs = () => PENDING_ACTION_TTL_MIN * 60_000;

export const createPendingAction = async (params: {
  conversationId: string;
  toolCallId: string;
  toolName: string;
  input: unknown;
  summary: ToolPreview;
}): Promise<PendingActionRecord> => {
  const expiresAt = new Date(Date.now() + pendingTtlMs());
  const created = await prisma.aiPendingAction.create({
    data: {
      conversationId: params.conversationId,
      toolCallId: params.toolCallId,
      toolName: params.toolName,
      input: params.input as Prisma.InputJsonValue,
      summary: params.summary as unknown as Prisma.InputJsonValue,
      status: 'PENDING',
      expiresAt,
    },
  });
  return {
    id: created.id,
    conversationId: created.conversationId,
    toolCallId: created.toolCallId,
    toolName: created.toolName,
    input: created.input,
    summary: created.summary as unknown as ToolPreview,
    status: created.status,
    expiresAt: created.expiresAt,
  };
};

/**
 * 按 toolCallId 查找待确认操作（toolCallId 唯一）。
 * LangGraph interrupt 恢复后节点会从头重跑，用它避免重复落库。
 */
export const findPendingActionByToolCallId = async (
  toolCallId: string
): Promise<PendingActionRecord | null> => {
  const row = await prisma.aiPendingAction.findUnique({
    where: { toolCallId },
  });
  if (!row) return null;
  return {
    id: row.id,
    conversationId: row.conversationId,
    toolCallId: row.toolCallId,
    toolName: row.toolName,
    input: row.input,
    summary: row.summary as unknown as ToolPreview,
    status: row.status,
    expiresAt: row.expiresAt,
  };
};

export const getPendingActionForOrg = async (
  actionId: string,
  organizationId: string
): Promise<PendingActionRecord | null> => {
  const row = await prisma.aiPendingAction.findUnique({
    where: { id: actionId },
  });
  if (!row) return null;
  const conv = await prisma.aiConversation.findUnique({
    where: { id: row.conversationId },
    select: { organizationId: true },
  });
  if (!conv || conv.organizationId !== organizationId) return null;
  return {
    id: row.id,
    conversationId: row.conversationId,
    toolCallId: row.toolCallId,
    toolName: row.toolName,
    input: row.input,
    summary: row.summary as unknown as ToolPreview,
    status: row.status,
    expiresAt: row.expiresAt,
  };
};

export const listPendingActions = async (
  conversationId: string
): Promise<PendingActionRecord[]> => {
  const rows = await prisma.aiPendingAction.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((row) => ({
    id: row.id,
    conversationId: row.conversationId,
    toolCallId: row.toolCallId,
    toolName: row.toolName,
    input: row.input,
    summary: row.summary as unknown as ToolPreview,
    status: row.status,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  }));
};

export const markPendingAction = async (
  actionId: string,
  status: 'CONFIRMED' | 'REJECTED',
  organizationId: string,
  userId: string
): Promise<PendingActionRecord> => {
  const row = await getPendingActionForOrg(actionId, organizationId);
  if (!row) throw new HttpError(404, '待确认操作不存在');

  const conv = await prisma.aiConversation.findUnique({
    where: { id: row.conversationId },
    select: { userId: true },
  });
  if (!conv) throw new HttpError(404, '会话不存在');
  if (conv.userId !== userId) throw new HttpError(403, '无权操作该会话');

  if (row.status !== 'PENDING') {
    throw new HttpError(400, `该待确认操作当前状态为 ${row.status}，无法处理`);
  }
  if (row.expiresAt.getTime() < Date.now()) {
    throw new HttpError(400, '该待确认操作已过期');
  }

  const updated = await prisma.aiPendingAction.update({
    where: { id: actionId },
    data: { status },
  });
  return {
    id: updated.id,
    conversationId: updated.conversationId,
    toolCallId: updated.toolCallId,
    toolName: updated.toolName,
    input: updated.input,
    summary: updated.summary as unknown as ToolPreview,
    status: updated.status,
    expiresAt: updated.expiresAt,
  };
};
