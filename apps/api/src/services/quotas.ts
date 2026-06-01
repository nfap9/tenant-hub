import { Prisma } from '@prisma/client';
import { basePrisma } from '../prisma/client.js';
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

export const lockOrganizationQuota = async (
  db: Prisma.TransactionClient,
  organizationId: string
) => {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`quota:${organizationId}`}))`;
};

export const isQuotaLimitEnabled = async (
  db: Prisma.TransactionClient = basePrisma
) => {
  const setting = await db.systemSetting.findUnique({
    where: { key: 'quota_limit_enabled' },
  });
  if (!setting) return false;
  return !!((setting.value as any)?.enabled ?? false);
};

export const getOrganizationQuota = async (
  organizationId: string,
  db: Prisma.TransactionClient = basePrisma
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

  const extraQuota = quotaPackages.reduce<{
    apartmentQuota: number;
    roomQuota: number;
    memberQuota: number;
  }>(
    (sum, item) => ({
      apartmentQuota: sum.apartmentQuota + item.apartmentQuota,
      roomQuota: sum.roomQuota + item.roomQuota,
      memberQuota: sum.memberQuota + item.memberQuota,
    }),
    { apartmentQuota: 0, roomQuota: 0, memberQuota: 0 }
  );

  return { subscription, extraQuota };
};

export const assertOrganizationQuota = async (
  organizationId: string,
  kind: QuotaKind,
  nextCount: number,
  db: Prisma.TransactionClient = basePrisma
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
