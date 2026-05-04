import { Router } from "express";
import { z } from "zod";
import { platformAdminPhones } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { requireAuth, requirePlatformAccess } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError, ok } from "../utils/http.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requirePlatformAccess);

adminRouter.get(
  "/users",
  asyncHandler(async (req, res) => {
    const keyword = z.string().optional().parse(req.query.keyword);
    const platformAdminCount = await prisma.user.count({ where: { platformRole: { not: "NONE" } } });
    const users = await prisma.user.findMany({
      where: keyword
        ? {
            OR: [
              { phone: { contains: keyword } },
              { username: { contains: keyword, mode: "insensitive" } }
            ]
          }
        : undefined,
      select: {
        id: true,
        phone: true,
        username: true,
        platformRole: true,
        createdAt: true,
        _count: { select: { memberships: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    ok(
      res,
      users.map((user) => ({
        ...user,
        effectivePlatformRole:
          user.platformRole !== "NONE"
            ? user.platformRole
            : platformAdminPhones.includes(user.phone) || (platformAdminCount === 0 && user.id === req.user!.id)
              ? "SUPER_ADMIN"
              : "NONE",
        bootstrapAdmin: platformAdminPhones.includes(user.phone) || (platformAdminCount === 0 && user.id === req.user!.id)
      }))
    );
  })
);

adminRouter.put(
  "/users/:id/platform-role",
  asyncHandler(async (req, res) => {
    const input = z.object({ platformRole: z.enum(["NONE", "OPERATOR", "ADMIN", "SUPER_ADMIN"]) }).parse(req.body);
    if (req.params.id === req.user!.id && input.platformRole === "NONE" && !platformAdminPhones.includes(req.user!.phone)) {
      throw new HttpError(400, "不能移除自己的运营权限");
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { platformRole: input.platformRole },
      select: { id: true, phone: true, username: true, platformRole: true }
    });
    ok(res, user);
  })
);

adminRouter.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    const [organizations, users, apartments, rooms, activeLeases, unpaidBills] = await Promise.all([
      prisma.organization.count({ where: { status: "ACTIVE" } }),
      prisma.user.count(),
      prisma.apartment.count(),
      prisma.room.count(),
      prisma.lease.count({ where: { status: "ACTIVE" } }),
      prisma.bill.count({ where: { status: { in: ["UNPAID", "PARTIAL_PAID", "BILLING", "FAILED"] } } })
    ]);
    ok(res, { organizations, users, apartments, rooms, activeLeases, unpaidBills });
  })
);

adminRouter.get(
  "/plans",
  asyncHandler(async (_req, res) => {
    ok(res, await prisma.plan.findMany({ orderBy: { createdAt: "desc" } }));
  })
);

adminRouter.post(
  "/plans",
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        name: z.string().min(1),
        apartmentLimit: z.coerce.number().int().min(0),
        roomLimit: z.coerce.number().int().min(0),
        memberLimit: z.coerce.number().int().min(0),
        price: z.coerce.number().min(0),
        enabled: z.boolean().default(true)
      })
      .parse(req.body);
    ok(res, await prisma.plan.create({ data: input }));
  })
);

adminRouter.put(
  "/plans/:id",
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        name: z.string().min(1).optional(),
        apartmentLimit: z.coerce.number().int().min(0).optional(),
        roomLimit: z.coerce.number().int().min(0).optional(),
        memberLimit: z.coerce.number().int().min(0).optional(),
        price: z.coerce.number().min(0).optional(),
        enabled: z.boolean().optional()
      })
      .parse(req.body);
    ok(res, await prisma.plan.update({ where: { id: req.params.id }, data: input }));
  })
);

adminRouter.get(
  "/organizations",
  asyncHandler(async (_req, res) => {
    ok(
      res,
      await prisma.organization.findMany({
        include: { subscriptions: { include: { plan: true } }, quotas: true, _count: { select: { apartments: true, members: true, bills: true } } },
        orderBy: { createdAt: "desc" }
      })
    );
  })
);

adminRouter.put(
  "/organizations/:id/status",
  asyncHandler(async (req, res) => {
    const input = z.object({ status: z.enum(["ACTIVE", "SUSPENDED", "DELETED"]) }).parse(req.body);
    ok(res, await prisma.organization.update({ where: { id: req.params.id }, data: input }));
  })
);

adminRouter.post(
  "/organizations/:id/quota-packages",
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        apartmentQuota: z.coerce.number().int().default(0),
        roomQuota: z.coerce.number().int().default(0),
        memberQuota: z.coerce.number().int().default(0),
        reason: z.string().optional()
      })
      .parse(req.body);
    ok(res, await prisma.orgQuotaPackage.create({ data: { ...input, organizationId: req.params.id } }));
  })
);

adminRouter.get(
  "/roles",
  asyncHandler(async (_req, res) => {
    ok(res, await prisma.role.findMany({ orderBy: [{ system: "desc" }, { createdAt: "asc" }] }));
  })
);

adminRouter.post(
  "/roles",
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        code: z.string().min(2).regex(/^[a-z][a-z0-9_-]*$/),
        name: z.string().min(1),
        description: z.string().optional(),
        permissions: z.array(z.string()).default([])
      })
      .parse(req.body);
    ok(res, await prisma.role.create({ data: { ...input, system: false } }));
  })
);

adminRouter.put(
  "/roles/:id",
  asyncHandler(async (req, res) => {
    const role = await prisma.role.findUniqueOrThrow({ where: { id: req.params.id } });
    const input = z
      .object({
        code: z.string().min(2).regex(/^[a-z][a-z0-9_-]*$/).optional(),
        name: z.string().min(1),
        description: z.string().optional(),
        permissions: z.array(z.string())
      })
      .parse(req.body);
    ok(res, await prisma.role.update({ where: { id: role.id }, data: { ...input, code: role.system ? role.code : input.code ?? role.code } }));
  })
);

adminRouter.delete(
  "/roles/:id",
  asyncHandler(async (req, res) => {
    const role = await prisma.role.findUniqueOrThrow({ where: { id: req.params.id }, include: { _count: { select: { members: true } } } });
    if (role.system) throw new HttpError(400, "系统预置角色不可删除");
    if (role._count.members > 0) throw new HttpError(400, "角色正在被成员使用，无法删除");
    ok(res, await prisma.role.delete({ where: { id: role.id } }));
  })
);

adminRouter.get(
  "/settings",
  asyncHandler(async (_req, res) => {
    ok(res, await prisma.systemSetting.findMany({ orderBy: { key: "asc" } }));
  })
);

adminRouter.put(
  "/settings/:key",
  asyncHandler(async (req, res) => {
    const input = z.object({ value: z.unknown(), description: z.string().optional() }).parse(req.body);
    ok(
      res,
      await prisma.systemSetting.upsert({
        where: { key: req.params.key },
        create: { key: req.params.key, value: input.value as object, description: input.description },
        update: { value: input.value as object, description: input.description }
      })
    );
  })
);
