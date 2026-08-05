import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/http.js';
import { getOrgTodayUsage } from '../ai/usage.js';
import { prisma } from '../config/prisma.js';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const RATE_LIMIT_PER_MIN = 20;

/** 惰性清理已过期的窗口 bucket，避免 Map 无限增长 */
const pruneBuckets = (now: number) => {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
};

/**
 * AI 接口限流中间件
 * - 滑动窗口：每用户每分钟 N 次
 * - 每日预算：只要组织设置了 aiDailyBudgetUsd 就强制执行，
 *   按组织级当日累计用量（跨所有用户）判断
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
  const limit = RATE_LIMIT_PER_MIN;
  pruneBuckets(now);
  const bucket = buckets.get(key);
  if (!bucket) {
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
    if (budget > 0) {
      const usage = await getOrgTodayUsage(req.organizationId);
      if (usage.totalCostUsd >= budget) {
        throw new HttpError(429, '已达当日 AI 使用预算上限');
      }
    }
  }

  next();
};
