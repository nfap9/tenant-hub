import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { HttpError } from '../utils/http.js';

type QuotaKind = 'apartment' | 'room' | 'member';

const quotaField: Record<
  QuotaKind,
  'apartmentLimit' | 'roomLimit' | 'memberLimit'
> = {
  apartment: 'apartmentLimit',
  room: 'roomLimit',
  member: 'memberLimit',
};

const extraField: Record<
  QuotaKind,
  'apartmentQuota' | 'roomQuota' | 'memberQuota'
> = {
  apartment: 'apartmentQuota',
  room: 'roomQuota',
  member: 'memberQuota',
};

const limitLabel: Record<QuotaKind, string> = {
  apartment: '公寓',
  room: '房间',
  member: '成员',
};

type PrismaLike = typeof prisma | Prisma.TransactionClient;

/**
 * 对指定组织的配额进行 PostgreSQL advisory lock 锁定，防止并发竞争
 * @param db - Prisma 事务客户端
 * @param organizationId - 组织 ID
 * @returns 无返回值
 */
export const lockOrganizationQuota = async (
  db: Prisma.TransactionClient,
  organizationId: string
) => {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`quota:${organizationId}`}))`;
};

/**
 * 检查系统是否开启了配额限制功能
 * @param db - Prisma 客户端（可选，默认使用全局 prisma 实例）
 * @returns 是否开启配额限制
 */
export const isQuotaLimitEnabled = async (db: PrismaLike = prisma) => {
  const setting = await db.systemSetting.findUnique({
    where: { key: 'quota_limit_enabled' },
  });
  if (!setting) return false;
  return !!((setting.value as any)?.enabled ?? false);
};

/**
 * 获取指定组织的当前配额信息（含订阅套餐和额外购买配额）
 * @param organizationId - 组织 ID
 * @param db - Prisma 客户端（可选，默认使用全局 prisma 实例）
 * @returns 配额信息对象（subscription + extraQuota），若未开启配额限制则返回无限额对象；若无有效订阅则返回 undefined
 */
export const getOrganizationQuota = async (
  organizationId: string,
  db: PrismaLike = prisma
) => {
  const enabled = await isQuotaLimitEnabled(db);
  if (!enabled) {
    return {
      subscription: {
        id: 'unlimited',
        organizationId,
        planId: 'unlimited',
        startsAt: new Date('2000-01-01'),
        endsAt: null,
        active: true,
        plan: {
          id: 'unlimited',
          name: '不限量',
          apartmentLimit: Number.MAX_SAFE_INTEGER,
          roomLimit: Number.MAX_SAFE_INTEGER,
          memberLimit: Number.MAX_SAFE_INTEGER,
          price: 0,
          enabled: true,
        },
      } as any,
      extraQuota: { apartmentQuota: 0, roomQuota: 0, memberQuota: 0 },
    };
  }

  const [subscription, quotaPackages] = await Promise.all([
    db.subscription.findFirst({
      where: {
        organizationId,
        active: true,
        OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
      },
      include: { plan: true },
      orderBy: { startsAt: 'desc' },
    }),
    db.orgQuotaPackage.findMany({ where: { organizationId } }),
  ]);

  if (!subscription) return undefined;

  const extraQuota = quotaPackages.reduce(
    (sum, item) => ({
      apartmentQuota: sum.apartmentQuota + item.apartmentQuota,
      roomQuota: sum.roomQuota + item.roomQuota,
      memberQuota: sum.memberQuota + item.memberQuota,
    }),
    { apartmentQuota: 0, roomQuota: 0, memberQuota: 0 }
  );

  return { subscription, extraQuota };
};

/**
 * 校验组织在指定资源类型下的配额是否足够
 * @param organizationId - 组织 ID
 * @param kind - 配额类型（apartment / room / member）
 * @param nextCount - 预期达到的数量
 * @param db - Prisma 客户端（可选，默认使用全局 prisma 实例）
 * @returns 无返回值
 * @throws HttpError 402 未购买套餐 / 403 超出配额上限
 */
export const assertOrganizationQuota = async (
  organizationId: string,
  kind: QuotaKind,
  nextCount: number,
  db: PrismaLike = prisma
) => {
  const enabled = await isQuotaLimitEnabled(db);
  if (!enabled) return;

  const quota = await getOrganizationQuota(organizationId, db);
  if (!quota) throw new HttpError(402, '请先购买套餐后再使用该功能');

  const baseLimit = quota.subscription.plan[quotaField[kind]];
  const extraLimit = quota.extraQuota[extraField[kind]];
  const limit = baseLimit + extraLimit;

  if (nextCount > limit) {
    throw new HttpError(
      403,
      `${limitLabel[kind]}数量已达到套餐额度上限（${nextCount}/${limit}）`
    );
  }
};

/**
 * 强制执行组织配额检查（先加锁再校验）
 * @param db - Prisma 事务客户端
 * @param organizationId - 组织 ID
 * @param kind - 配额类型（apartment / room / member）
 * @param getNextCount - 异步函数，用于获取预期达到的数量
 * @returns 无返回值
 * @throws HttpError 402 未购买套餐 / 403 超出配额上限
 */
export const enforceOrganizationQuota = async (
  db: Prisma.TransactionClient,
  organizationId: string,
  kind: QuotaKind,
  getNextCount: () => Promise<number>
) => {
  const enabled = await isQuotaLimitEnabled(db);
  if (!enabled) return;

  await lockOrganizationQuota(db, organizationId);
  await assertOrganizationQuota(organizationId, kind, await getNextCount(), db);
};
