import type { AiConversation, AiMessage, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http.js';
import type { ChatMessage, ChatRole, ToolCall } from './types.js';
import { findModel, resolveDefaultModel } from './models.config.js';
import type { ToolPreview } from './tools/types.js';

export interface ConversationOwnership {
  id: string;
  organizationId: string;
  userId: string;
  modelId: string;
}

export const ensureConversationOwnership = async (
  conversationId: string,
  organizationId: string,
  userId: string
): Promise<ConversationOwnership> => {
  const conv = await prisma.aiConversation.findFirst({
    where: { id: conversationId, organizationId },
    select: { id: true, organizationId: true, userId: true, modelId: true },
  });
  if (!conv) throw new HttpError(404, '会话不存在');
  if (conv.userId !== userId) throw new HttpError(403, '无权访问该会话');
  return conv;
};

export const createConversation = async (params: {
  organizationId: string;
  userId: string;
  modelId?: string;
}): Promise<AiConversation> => {
  const model = params.modelId
    ? findModel(params.modelId)
    : resolveDefaultModel();
  if (!model) throw new HttpError(400, '模型不存在或未启用');
  if (!model.enabled) throw new HttpError(400, `模型 ${model.id} 未启用`);

  return prisma.aiConversation.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId,
      modelId: model.id,
    },
  });
};

export const listConversations = async (
  organizationId: string,
  userId: string
): Promise<AiConversation[]> => {
  return prisma.aiConversation.findMany({
    where: { organizationId, userId, status: 'ACTIVE' },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
};

export const listMessages = async (
  conversationId: string
): Promise<AiMessage[]> => {
  return prisma.aiMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: env.AI_HISTORY_MAX_TURNS * 2,
  });
};

export const appendUserMessage = async (
  conversationId: string,
  content: string
): Promise<AiMessage> => {
  const [message] = await prisma.$transaction([
    prisma.aiMessage.create({
      data: { conversationId, role: 'USER', content: content },
    }),
    prisma.aiConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);
  return message;
};

export const appendAssistantMessage = async (
  conversationId: string,
  params: {
    content: string;
    toolCalls?: ToolCall[];
    modelId: string;
    tokensInput?: number;
    tokensOutput?: number;
  }
): Promise<AiMessage> => {
  return prisma.aiMessage.create({
    data: {
      conversationId,
      role: 'ASSISTANT',
      content: params.toolCalls?.length
        ? ({
            text: params.content,
            toolCalls: params.toolCalls,
          } as unknown as Prisma.InputJsonValue)
        : params.content,
      modelId: params.modelId,
      tokensInput: params.tokensInput,
      tokensOutput: params.tokensOutput,
    },
  });
};

export const appendToolMessage = async (
  conversationId: string,
  toolCallId: string,
  content: string
): Promise<AiMessage> => {
  return prisma.aiMessage.create({
    data: {
      conversationId,
      role: 'TOOL',
      content: { toolCallId, content },
    },
  });
};

export const historyToChatMessages = (messages: AiMessage[]): ChatMessage[] => {
  return messages
    .filter((m) => m.role !== 'SYSTEM')
    .map((m): ChatMessage => {
      if (m.role === 'ASSISTANT' && typeof m.content === 'object') {
        const obj = m.content as { text?: string; toolCalls?: ToolCall[] };
        return {
          role: 'assistant',
          content: obj.text ?? '',
          toolCalls: obj.toolCalls,
        };
      }
      if (m.role === 'TOOL' && typeof m.content === 'object') {
        const obj = m.content as { toolCallId?: string; content?: string };
        return {
          role: 'tool',
          content: obj.content ?? '',
          toolCallId: obj.toolCallId,
        };
      }
      const content =
        typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      return {
        role: m.role.toLowerCase() as ChatRole,
        content,
      };
    });
};

export interface PendingActionRecord {
  id: string;
  conversationId: string;
  toolCallId: string;
  toolName: string;
  input: unknown;
  summary: ToolPreview;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED';
  expiresAt: Date;
}

const pendingTtlMs = () => env.AI_PENDING_ACTION_TTL_MIN * 60_000;

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

export const archiveConversation = async (
  conversationId: string,
  organizationId: string,
  userId: string
): Promise<void> => {
  const conv = await ensureConversationOwnership(
    conversationId,
    organizationId,
    userId
  );
  await prisma.aiConversation.update({
    where: { id: conv.id },
    data: { status: 'ARCHIVED' },
  });
};
