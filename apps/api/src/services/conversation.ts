import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { HttpError } from '../utils/http.js';

const MAX_CONVERSATIONS = 50;
const RETENTION_DAYS = 90;

interface MessageInput {
  id: string;
  role: string;
  content: string;
  chartData?: unknown;
  thinking?: string[];
}

interface CreateConversationInput {
  userId: string;
  organizationId: string;
  title: string;
}

interface UpdateConversationInput {
  title?: string;
  archived?: boolean;
}

interface ListOptions {
  archived?: boolean;
  limit?: number;
  cursor?: string;
}

/**
 * 清理超期和超限的会话
 */
export async function cleanupConversations(
  userId: string,
  organizationId: string
) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  // 删除超期会话
  await prisma.agentConversation.deleteMany({
    where: {
      userId,
      organizationId,
      updatedAt: { lt: cutoffDate },
    },
  });

  // 删除超限的最旧会话
  const count = await prisma.agentConversation.count({
    where: { userId, organizationId },
  });

  if (count > MAX_CONVERSATIONS) {
    const overflow = count - MAX_CONVERSATIONS;
    const oldest = await prisma.agentConversation.findMany({
      where: { userId, organizationId },
      orderBy: { updatedAt: 'asc' },
      take: overflow,
      select: { id: true },
    });

    if (oldest.length > 0) {
      await prisma.agentConversation.deleteMany({
        where: {
          id: { in: oldest.map((o) => o.id) },
        },
      });
    }
  }
}

/**
 * 列出会话（支持归档过滤和游标分页）
 */
export async function listConversations(
  userId: string,
  organizationId: string,
  options: ListOptions = {}
) {
  const { archived = false, limit = 20, cursor } = options;

  const items = await prisma.agentConversation.findMany({
    where: {
      userId,
      organizationId,
      archived,
    },
    orderBy: { updatedAt: 'desc' },
    take: limit + 1,
    ...(cursor
      ? {
          skip: 1,
          cursor: { id: cursor },
        }
      : {}),
    select: {
      id: true,
      title: true,
      archived: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const hasMore = items.length > limit;
  const results = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? results[results.length - 1]?.id : undefined;

  return {
    items: results,
    nextCursor,
  };
}

/**
 * 获取会话详情（含消息）
 */
export async function getConversationWithMessages(
  id: string,
  userId: string,
  organizationId: string
) {
  const conversation = await prisma.agentConversation.findFirst({
    where: { id, userId, organizationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          chartData: true,
          thinking: true,
          createdAt: true,
        },
      },
    },
  });

  if (!conversation) {
    throw new HttpError(404, '会话不存在');
  }

  return conversation;
}

/**
 * 创建新会话
 */
export async function createConversation(data: CreateConversationInput) {
  await cleanupConversations(data.userId, data.organizationId);

  return prisma.agentConversation.create({
    data: {
      userId: data.userId,
      organizationId: data.organizationId,
      title: data.title,
    },
    select: {
      id: true,
      title: true,
      archived: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * 更新会话
 */
export async function updateConversation(
  id: string,
  userId: string,
  organizationId: string,
  data: UpdateConversationInput
) {
  const conversation = await prisma.agentConversation.findFirst({
    where: { id, userId, organizationId },
  });

  if (!conversation) {
    throw new HttpError(404, '会话不存在');
  }

  return prisma.agentConversation.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.archived !== undefined ? { archived: data.archived } : {}),
    },
    select: {
      id: true,
      title: true,
      archived: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * 删除会话
 */
export async function deleteConversation(
  id: string,
  userId: string,
  organizationId: string
) {
  const conversation = await prisma.agentConversation.findFirst({
    where: { id, userId, organizationId },
  });

  if (!conversation) {
    throw new HttpError(404, '会话不存在');
  }

  await prisma.agentConversation.delete({
    where: { id },
  });
}

/**
 * 保存/替换会话消息
 */
export async function saveMessages(
  conversationId: string,
  userId: string,
  organizationId: string,
  messages: MessageInput[]
) {
  const conversation = await prisma.agentConversation.findFirst({
    where: { id: conversationId, userId, organizationId },
  });

  if (!conversation) {
    throw new HttpError(404, '会话不存在');
  }

  await prisma.$transaction(async (tx) => {
    // 删除旧消息
    await tx.agentConversationMessage.deleteMany({
      where: { conversationId },
    });

    // 批量创建新消息
    if (messages.length > 0) {
      await tx.agentConversationMessage.createMany({
        data: messages.map((m) => ({
          conversationId,
          role: m.role,
          content: m.content,
          chartData: m.chartData
            ? (m.chartData as Prisma.InputJsonValue)
            : undefined,
          thinking: m.thinking ?? [],
        })),
      });
    }

    // 更新会话的 updatedAt
    await tx.agentConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  });
}
