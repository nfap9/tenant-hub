import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http.js';
import { getTodayUsage } from '../ai/usage.js';
import { prisma } from '../config/prisma.js';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const DAILY_BUDGET_WARN_ONLY_USD = 100;

/**
 * AI 接口限流中间件
 * - 滑动窗口：每用户每分钟 N 次（AI_RATE_LIMIT_PER_MIN）
 * - 每日预算：若组织设置了 aiDailyBudgetUsd 且当日累计已超，则拒绝
 */
export const aiRateLimiter = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (!req.user || !req.organizationId) {
    throw new HttpError(401, '请先登录');
  }

  const key = `${req.user.id}:${req.organizationId}`;
  const now = Date.now();
  const limit = env.AI_RATE_LIMIT_PER_MIN;
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
  } else {
    bucket.count += 1;
    if (bucket.count > limit) {
      throw new HttpError(429, '请求过于频繁，请稍后再试');
    }
  }

  const org = await prisma.organization.findUnique({
    where: { id: req.organizationId },
    select: { aiDailyBudgetUsd: true, aiEnabled: true },
  });
  if (!org) throw new HttpError(403, '无组织访问权限');
  if (org.aiEnabled === false) throw new HttpError(403, '该组织未启用 AI 功能');

  if (org.aiDailyBudgetUsd) {
    const budget = Number(org.aiDailyBudgetUsd);
    if (budget > 0 && budget < DAILY_BUDGET_WARN_ONLY_USD) {
      const usage = await getTodayUsage(req.organizationId, req.user.id);
      if (usage.totalCostUsd >= budget) {
        throw new HttpError(429, '已达当日 AI 使用预算上限');
      }
    }
  }

  next();
};
