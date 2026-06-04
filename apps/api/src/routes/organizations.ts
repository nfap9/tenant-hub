import { Router } from 'express';
import { z } from 'zod';
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, ok } from '../utils/http.js';
import { PERMISSIONS } from '../services/roles.js';
import { isQuotaLimitEnabled } from '../services/quotas.js';
import {
  listUserOrganizations,
  createOrganization,
  findOrganizationByInviteCode,
  joinOrganization,
  getOrganizationById,
  refreshOrganizationInviteCode,
  listPlans,
  getOrganizationSubscription,
  getOrganizationUsage,
  listOrgQuotaPackages,
  findPlanById,
  createSubscription,
  updateOrganization,
  getOrganizationWithSubscriptions,
  softDeleteOrganization,
  listRoles,
  listOrgMembers,
  getOrgMemberWithRole,
  disableOrgMember,
  updateOrgMemberRole,
  findRoleByCode,
  transferOrganizationOwnership,
} from '../services/organization.js';

export const orgRouter = Router();

orgRouter.use(requireAuth);

orgRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    ok(res, await listUserOrganizations(req.user!.id));
  })
);

orgRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = z
      .object({ name: z.string().min(1), description: z.string().optional() })
      .parse(req.body);
    ok(res, await createOrganization({ ...input, userId: req.user!.id }));
  })
);

orgRouter.post(
  '/join',
  asyncHandler(async (req, res) => {
    const input = z.object({ inviteCode: z.string().min(6) }).parse(req.body);
    const organization = await findOrganizationByInviteCode(input.inviteCode);
    if (!organization) throw new HttpError(404, '邀请码不存在');
    if (organization.status !== 'ACTIVE')
      throw new HttpError(403, '组织不可加入');

    const member = await joinOrganization({
      organizationId: organization.id,
      userId: req.user!.id,
    });
    ok(res, { organization, member });
  })
);

orgRouter.post(
  '/:organizationId/refresh-invite-code',
  requireOrg,
  asyncHandler(async (req, res) => {
    const org = await getOrganizationById(req.organizationId!);
    if (org.ownerId !== req.user!.id)
      throw new HttpError(403, '仅所有者可刷新邀请码');
    const updated = await refreshOrganizationInviteCode(org.id);
    ok(res, { inviteCode: updated.inviteCode });
  })
);

orgRouter.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    ok(res, await listPlans());
  })
);

orgRouter.get(
  '/:organizationId/subscription',
  requireOrg,
  asyncHandler(async (req, res) => {
    const [subscription, usage, quotaPackages, quotaLimitEnabled] =
      await Promise.all([
        getOrganizationSubscription(req.organizationId!),
        getOrganizationUsage(req.organizationId!),
        listOrgQuotaPackages(req.organizationId!),
        isQuotaLimitEnabled(),
      ]);

    const extraQuota = quotaPackages.reduce(
      (sum, item) => ({
        apartmentQuota: sum.apartmentQuota + item.apartmentQuota,
        roomQuota: sum.roomQuota + item.roomQuota,
        memberQuota: sum.memberQuota + item.memberQuota,
      }),
      { apartmentQuota: 0, roomQuota: 0, memberQuota: 0 }
    );

    ok(res, {
      subscription,
      usage: usage._count,
      extraQuota,
      quotaPackages,
      quotaLimitEnabled,
    });
  })
);

orgRouter.post(
  '/:organizationId/subscriptions',
  requireOrg,
  requirePermission(PERMISSIONS.ORG_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z.object({ planId: z.string() }).parse(req.body);
    const plan = await findPlanById(input.planId);
    if (!plan || !plan.enabled) throw new HttpError(404, '套餐不存在或已停用');

    ok(
      res,
      await createSubscription({
        organizationId: req.organizationId!,
        planId: plan.id,
      })
    );
  })
);

orgRouter.put(
  '/:organizationId',
  requireOrg,
  requirePermission(PERMISSIONS.ORG_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({ name: z.string().min(1), description: z.string().optional() })
      .parse(req.body);
    ok(res, await updateOrganization(req.organizationId!, input));
  })
);

orgRouter.delete(
  '/:organizationId',
  requireOrg,
  requirePermission(PERMISSIONS.ORG_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z.object({ confirmName: z.string() }).parse(req.body);
    const org = await getOrganizationWithSubscriptions(req.organizationId!);
    if (!org) throw new HttpError(404, '组织不存在');
    if (org.ownerId !== req.user!.id)
      throw new HttpError(403, '仅所有者可删除组织');
    if (org.subscriptions.length > 0)
      throw new HttpError(400, '组织存在有效订阅，无法删除');
    if (input.confirmName !== org.name)
      throw new HttpError(400, '二次确认不匹配');
    ok(res, await softDeleteOrganization(org.id));
  })
);

orgRouter.get(
  '/:organizationId/roles',
  requireOrg,
  asyncHandler(async (_req, res) => {
    ok(res, await listRoles());
  })
);

orgRouter.get(
  '/:organizationId/members',
  requireOrg,
  asyncHandler(async (req, res) => {
    ok(res, await listOrgMembers(req.organizationId!));
  })
);

orgRouter.delete(
  '/:organizationId/members/:memberId',
  requireOrg,
  requirePermission(PERMISSIONS.MEMBER_MANAGE),
  asyncHandler(async (req, res) => {
    const member = await getOrgMemberWithRole(req.params.memberId);
    if (member.organizationId !== req.organizationId)
      throw new HttpError(404, '成员不存在');
    if (member.role.code === 'owner')
      throw new HttpError(400, '所有者不可移除');
    ok(res, await disableOrgMember(member.id));
  })
);

orgRouter.put(
  '/:organizationId/members/:memberId/role',
  requireOrg,
  requirePermission(PERMISSIONS.MEMBER_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z.object({ roleId: z.string() }).parse(req.body);
    const member = await getOrgMemberWithRole(req.params.memberId);
    const ownerRole = await findRoleByCode('owner');
    if (input.roleId === ownerRole.id)
      throw new HttpError(400, '请使用所有者转移功能');
    if (member.roleId === ownerRole.id)
      throw new HttpError(400, '所有者角色不可直接修改');
    ok(res, await updateOrgMemberRole(member.id, input.roleId));
  })
);

orgRouter.post(
  '/:organizationId/transfer-owner',
  requireOrg,
  asyncHandler(async (req, res) => {
    const input = z.object({ userId: z.string() }).parse(req.body);
    const org = await getOrganizationById(req.organizationId!);
    if (org.ownerId !== req.user!.id)
      throw new HttpError(403, '仅所有者可转移所有者身份');
    await transferOrganizationOwnership({
      organizationId: org.id,
      fromUserId: req.user!.id,
      toUserId: input.userId,
    });
    ok(res, { message: '所有者已转移' });
  })
);
