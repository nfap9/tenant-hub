import { Router } from "express";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth, requireOrg, requirePermission } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError, ok } from "../utils/http.js";
import { PERMISSIONS } from "../services/roles.js";

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
    const input = z.object({ code: z.string().min(4) }).parse(req.body);
    const organization = await prisma.organization.findUnique({ where: { code: input.code } });
    if (!organization || organization.status !== "ACTIVE") throw new HttpError(404, "组织不存在");
    const role = await prisma.role.findUniqueOrThrow({ where: { code: "readonly" } });
    const member = await prisma.orgMember.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: req.user!.id } },
      create: { organizationId: organization.id, userId: req.user!.id, roleId: role.id },
      update: { status: "ACTIVE" }
    });
    ok(res, { organization, member });
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
