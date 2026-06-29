import { prisma } from '../config/prisma.js';
import type { ChatUsage } from './types.js';
import type { ModelConfig } from './models.config.js';

const utcDate = () => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
};

export const recordUsage = async (
  params: {
    organizationId: string;
    userId: string;
    model: ModelConfig;
    usage: ChatUsage;
  },
  tx?: typeof prisma
): Promise<void> => {
  const db = tx ?? prisma;
  const inputTokens = params.usage.inputTokens ?? 0;
  const outputTokens = params.usage.outputTokens ?? 0;
  const cost =
    params.model.costPerMtu != null
      ? (inputTokens * params.model.costPerMtu.input +
          outputTokens * params.model.costPerMtu.output) /
        1_000_000
      : 0;

  const date = utcDate();
  const existing = await db.aiUsageDaily.findUnique({
    where: {
      organizationId_userId_modelId_date: {
        organizationId: params.organizationId,
        userId: params.userId,
        modelId: params.model.id,
        date,
      },
    },
  });

  if (existing) {
    await db.aiUsageDaily.update({
      where: { id: existing.id },
      data: {
        inputTokens: { increment: inputTokens },
        outputTokens: { increment: outputTokens },
        estimatedCostUsd: { increment: cost },
        requestCount: { increment: 1 },
      },
    });
  } else {
    await db.aiUsageDaily.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        modelId: params.model.id,
        date,
        inputTokens,
        outputTokens,
        estimatedCostUsd: cost,
        requestCount: 1,
      },
    });
  }
};

export const getTodayUsage = async (
  organizationId: string,
  userId: string
): Promise<{ totalCostUsd: number; totalRequests: number }> => {
  const date = utcDate();
  const rows = await prisma.aiUsageDaily.findMany({
    where: { organizationId, userId, date },
  });
  return rows.reduce(
    (acc, r) => {
      acc.totalCostUsd += Number(r.estimatedCostUsd);
      acc.totalRequests += r.requestCount;
      return acc;
    },
    { totalCostUsd: 0, totalRequests: 0 }
  );
};
