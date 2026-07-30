import { prisma } from '../config/prisma.js';
import type { ChatUsage } from './llm/types.js';
import type { ModelConfig } from './models/types.js';

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
  const key = {
    organizationId: params.organizationId,
    userId: params.userId,
    modelId: params.model.id,
    date,
  };

  // upsert 避免并发下 findUnique 后分支 update/create 撞唯一键
  await db.aiUsageDaily.upsert({
    where: { organizationId_userId_modelId_date: key },
    create: {
      ...key,
      inputTokens,
      outputTokens,
      estimatedCostUsd: cost,
      requestCount: 1,
    },
    update: {
      inputTokens: { increment: inputTokens },
      outputTokens: { increment: outputTokens },
      estimatedCostUsd: { increment: cost },
      requestCount: { increment: 1 },
    },
  });
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

/** 组织级当日用量聚合（跨所有用户与模型），用于日预算强制执行 */
export const getOrgTodayUsage = async (
  organizationId: string
): Promise<{ totalCostUsd: number; totalRequests: number }> => {
  const date = utcDate();
  const agg = await prisma.aiUsageDaily.aggregate({
    where: { organizationId, date },
    _sum: { estimatedCostUsd: true, requestCount: true },
  });
  return {
    totalCostUsd: Number(agg._sum.estimatedCostUsd ?? 0),
    totalRequests: agg._sum.requestCount ?? 0,
  };
};
