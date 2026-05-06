import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/http.js";

type QuotaKind = "apartment" | "room" | "member";

const quotaField: Record<QuotaKind, "apartmentLimit" | "roomLimit" | "memberLimit"> = {
  apartment: "apartmentLimit",
  room: "roomLimit",
  member: "memberLimit"
};

const extraField: Record<QuotaKind, "apartmentQuota" | "roomQuota" | "memberQuota"> = {
  apartment: "apartmentQuota",
  room: "roomQuota",
  member: "memberQuota"
};

const limitLabel: Record<QuotaKind, string> = {
  apartment: "公寓",
  room: "房间",
  member: "成员"
};

type PrismaLike = typeof prisma | Prisma.TransactionClient;

export const lockOrganizationQuota = async (db: Prisma.TransactionClient, organizationId: string) => {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`quota:${organizationId}`}))`;
};

export const getOrganizationQuota = async (organizationId: string, db: PrismaLike = prisma) => {
  const [subscription, quotaPackages] = await Promise.all([
    db.subscription.findFirst({
      where: {
        organizationId,
        active: true,
        OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }]
      },
      include: { plan: true },
      orderBy: { startsAt: "desc" }
    }),
    db.orgQuotaPackage.findMany({ where: { organizationId } })
  ]);

  if (!subscription) return undefined;

  const extraQuota = quotaPackages.reduce(
    (sum, item) => ({
      apartmentQuota: sum.apartmentQuota + item.apartmentQuota,
      roomQuota: sum.roomQuota + item.roomQuota,
      memberQuota: sum.memberQuota + item.memberQuota
    }),
    { apartmentQuota: 0, roomQuota: 0, memberQuota: 0 }
  );

  return { subscription, extraQuota };
};

export const assertOrganizationQuota = async (organizationId: string, kind: QuotaKind, nextCount: number, db: PrismaLike = prisma) => {
  const quota = await getOrganizationQuota(organizationId, db);
  if (!quota) throw new HttpError(402, "请先购买套餐后再使用该功能");

  const baseLimit = quota.subscription.plan[quotaField[kind]];
  const extraLimit = quota.extraQuota[extraField[kind]];
  const limit = baseLimit + extraLimit;

  if (nextCount > limit) {
    throw new HttpError(403, `${limitLabel[kind]}数量已达到套餐额度上限（${nextCount}/${limit}）`);
  }
};
