import { Router } from "express";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { requireAuth, requireOrg, requirePermission } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError, ok } from "../utils/http.js";
import { PERMISSIONS } from "../services/roles.js";
import { assertOrganizationQuota, lockOrganizationQuota } from "../services/quotas.js";
import { assertInviteJoinable, buildInviteExpiry, generateInviteCode, normalizeInviteCode } from "../services/orgInvites.js";

export const orgRouter = Router();
const orgCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

orgRouter.use(requireAuth);

orgRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const memberships = await prisma.orgMember.findMany({
      where: { userId: req.user!.id, status: "ACTIVE" },
      include: { organization: true, role: true }
    });
    ok(res, memberships);
  })
);

orgRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = z.object({ name: z.string().min(1), description: z.string().optional() }).parse(req.body);
    const role = await prisma.role.findUniqueOrThrow({ where: { code: "owner" } });
    const organization = await prisma.organization.create({
      data: {
        name: input.name,
        description: input.description,
        code: orgCode(),
        ownerId: req.user!.id,
        members: { create: { userId: req.user!.id, roleId: role.id } }
      }
    });
    ok(res, organization);
  })
);

orgRouter.post(
  "/join",
  asyncHandler(async (req, res) => {
    const input = z.object({ inviteCode: z.string().min(6) }).parse(req.body);
    const invite = await prisma.orgInvite.findUnique({
      where: { code: normalizeInviteCode(input.inviteCode) },
      include: { organization: true }
    });
    if (!invite) throw new HttpError(404, "邀请码不存在");
    assertInviteJoinable({ invite });

    const role = await prisma.role.findUniqueOrThrow({ where: { code: "readonly" } });
    const member = await prisma.$transaction(async (tx) => {
      await lockOrganizationQuota(tx, invite.organizationId);
      const existingMember = await tx.orgMember.findUnique({
        where: { organizationId_userId: { organizationId: invite.organizationId, userId: req.user!.id } }
      });
      const activeMemberCount = await tx.orgMember.count({ where: { organizationId: invite.organizationId, status: "ACTIVE" } });
      if (existingMember?.status === "ACTIVE") return existingMember;
      await assertOrganizationQuota(invite.organizationId, "member", activeMemberCount + 1, tx);
      const consumed = await tx.orgInvite.updateMany({
        where: { id: invite.id, usedCount: { lt: invite.maxUses } },
        data: {
          usedCount: { increment: 1 },
          usedAt: new Date(),
          usedById: req.user!.id
        }
      });
      if (consumed.count !== 1) throw new HttpError(400, "邀请码已被使用");
      return tx.orgMember.upsert({
        where: { organizationId_userId: { organizationId: invite.organizationId, userId: req.user!.id } },
        create: { organizationId: invite.organizationId, userId: req.user!.id, roleId: role.id },
        update: { status: "ACTIVE" }
      });
    });
    ok(res, { organization: invite.organization, member });
  })
);

orgRouter.get(
  "/:organizationId/invites",
  requireOrg,
  requirePermission(PERMISSIONS.MEMBER_MANAGE),
  asyncHandler(async (req, res) => {
    ok(
      res,
      await prisma.orgInvite.findMany({
        where: { organizationId: req.organizationId! },
        include: {
          createdBy: { select: { id: true, username: true, phone: true } },
          usedBy: { select: { id: true, username: true, phone: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 10
      })
    );
  })
);

orgRouter.post(
  "/:organizationId/invites",
  requireOrg,
  requirePermission(PERMISSIONS.MEMBER_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z.object({ expiresInHours: z.coerce.number().int().min(1).max(env.INVITE_EXPIRES_MAX_HOURS).default(env.INVITE_EXPIRES_IN_HOURS) }).parse(req.body);
    const invite = await prisma.orgInvite.create({
      data: {
        organizationId: req.organizationId!,
        code: generateInviteCode(),
        expiresAt: buildInviteExpiry(new Date(), input.expiresInHours),
        createdById: req.user!.id
      },
      include: { createdBy: { select: { id: true, username: true, phone: true } } }
    });
    ok(res, invite);
  })
);

orgRouter.get(
  "/plans",
  asyncHandler(async (_req, res) => {
    ok(res, await prisma.plan.findMany({ where: { enabled: true }, orderBy: [{ price: "asc" }, { createdAt: "asc" }] }));
  })
);

orgRouter.get(
  "/:organizationId/subscription",
  requireOrg,
  asyncHandler(async (req, res) => {
    const [subscription, usage, quotaPackages] = await Promise.all([
      prisma.subscription.findFirst({
        where: {
          organizationId: req.organizationId!,
          active: true,
          OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }]
        },
        include: { plan: true },
        orderBy: { startsAt: "desc" }
      }),
      prisma.organization.findUniqueOrThrow({
        where: { id: req.organizationId! },
        select: { _count: { select: { apartments: true, members: true } } }
      }),
      prisma.orgQuotaPackage.findMany({
        where: { organizationId: req.organizationId! },
        orderBy: { createdAt: "desc" }
      })
    ]);

    const extraQuota = quotaPackages.reduce(
      (sum, item) => ({
        apartmentQuota: sum.apartmentQuota + item.apartmentQuota,
        roomQuota: sum.roomQuota + item.roomQuota,
        memberQuota: sum.memberQuota + item.memberQuota
      }),
      { apartmentQuota: 0, roomQuota: 0, memberQuota: 0 }
    );

    ok(res, { subscription, usage: usage._count, extraQuota, quotaPackages });
  })
);

orgRouter.post(
  "/:organizationId/subscriptions",
  requireOrg,
  requirePermission(PERMISSIONS.ORG_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z.object({ planId: z.string() }).parse(req.body);
    const plan = await prisma.plan.findUnique({ where: { id: input.planId } });
    if (!plan || !plan.enabled) throw new HttpError(404, "套餐不存在或已停用");

    const subscription = await prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: { organizationId: req.organizationId!, active: true },
        data: { active: false, endsAt: new Date() }
      });
      return tx.subscription.create({
        data: {
          organizationId: req.organizationId!,
          planId: plan.id,
          startsAt: new Date(),
          endsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        },
        include: { plan: true }
      });
    });

    ok(res, subscription);
  })
);

orgRouter.put(
  "/:organizationId",
  requireOrg,
  requirePermission(PERMISSIONS.ORG_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z.object({ name: z.string().min(1), description: z.string().optional() }).parse(req.body);
    ok(res, await prisma.organization.update({ where: { id: req.organizationId! }, data: input }));
  })
);

orgRouter.delete(
  "/:organizationId",
  requireOrg,
  requirePermission(PERMISSIONS.ORG_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z.object({ confirmName: z.string() }).parse(req.body);
    const org = await prisma.organization.findUnique({
      where: { id: req.organizationId! },
      include: { subscriptions: { where: { active: true } } }
    });
    if (!org) throw new HttpError(404, "组织不存在");
    if (org.ownerId !== req.user!.id) throw new HttpError(403, "仅所有者可删除组织");
    if (org.subscriptions.length > 0) throw new HttpError(400, "组织存在有效订阅，无法删除");
    if (input.confirmName !== org.name) throw new HttpError(400, "二次确认不匹配");
    ok(res, await prisma.organization.update({ where: { id: org.id }, data: { status: "DELETED" } }));
  })
);

orgRouter.get(
  "/:organizationId/roles",
  requireOrg,
  asyncHandler(async (_req, res) => {
    ok(res, await prisma.role.findMany({ orderBy: [{ system: "desc" }, { createdAt: "asc" }] }));
  })
);

orgRouter.get(
  "/:organizationId/members",
  requireOrg,
  asyncHandler(async (req, res) => {
    const members = await prisma.orgMember.findMany({
      where: { organizationId: req.organizationId! },
      include: { user: { select: { id: true, phone: true, username: true } }, role: true }
    });
    ok(res, members);
  })
);

orgRouter.delete(
  "/:organizationId/members/:memberId",
  requireOrg,
  requirePermission(PERMISSIONS.MEMBER_MANAGE),
  asyncHandler(async (req, res) => {
    const member = await prisma.orgMember.findUniqueOrThrow({
      where: { id: req.params.memberId },
      include: { role: true }
    });
    if (member.organizationId !== req.organizationId) throw new HttpError(404, "成员不存在");
    if (member.role.code === "owner") throw new HttpError(400, "所有者不可移除");
    ok(res, await prisma.orgMember.update({ where: { id: member.id }, data: { status: "DISABLED" } }));
  })
);

orgRouter.put(
  "/:organizationId/members/:memberId/role",
  requireOrg,
  requirePermission(PERMISSIONS.MEMBER_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z.object({ roleId: z.string() }).parse(req.body);
    const member = await prisma.orgMember.findUniqueOrThrow({ where: { id: req.params.memberId } });
    const ownerRole = await prisma.role.findUniqueOrThrow({ where: { code: "owner" } });
    if (input.roleId === ownerRole.id) throw new HttpError(400, "请使用所有者转移功能");
    if (member.roleId === ownerRole.id) throw new HttpError(400, "所有者角色不可直接修改");
    ok(res, await prisma.orgMember.update({ where: { id: member.id }, data: { roleId: input.roleId } }));
  })
);

orgRouter.post(
  "/:organizationId/transfer-owner",
  requireOrg,
  asyncHandler(async (req, res) => {
    const input = z.object({ userId: z.string() }).parse(req.body);
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: req.organizationId! } });
    if (org.ownerId !== req.user!.id) throw new HttpError(403, "仅所有者可转移所有者身份");
    const ownerRole = await prisma.role.findUniqueOrThrow({ where: { code: "owner" } });
    const managerRole = await prisma.role.findUniqueOrThrow({ where: { code: "manager" } });
    await prisma.$transaction([
      prisma.organization.update({ where: { id: org.id }, data: { ownerId: input.userId } }),
      prisma.orgMember.update({
        where: { organizationId_userId: { organizationId: org.id, userId: req.user!.id } },
        data: { roleId: managerRole.id }
      }),
      prisma.orgMember.update({
        where: { organizationId_userId: { organizationId: org.id, userId: input.userId } },
        data: { roleId: ownerRole.id }
      })
    ]);
    ok(res, { message: "所有者已转移" });
  })
);
