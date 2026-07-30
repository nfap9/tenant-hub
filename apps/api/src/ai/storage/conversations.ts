import type { AiConversation } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { HttpError } from '../../utils/http.js';
import {
  findEnabledModel,
  findModel,
  resolveDefaultModel,
} from '../models/registry.js';

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
  let model;
  if (params.modelId) {
    model = findModel(params.modelId);
    if (!model) throw new HttpError(400, '模型不存在或未启用');
    if (!model.enabled) throw new HttpError(400, `模型 ${model.id} 未启用`);
  } else {
    // 未显式指定模型时，优先用组织级默认模型（须已启用），否则回落到注册表默认模型
    const org = await prisma.organization.findUnique({
      where: { id: params.organizationId },
      select: { aiModelDefault: true },
    });
    model = org?.aiModelDefault
      ? findEnabledModel(org.aiModelDefault)
      : undefined;
    if (!model) {
      try {
        model = resolveDefaultModel();
      } catch {
        throw new HttpError(400, '无可用的 AI 模型');
      }
    }
  }

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
