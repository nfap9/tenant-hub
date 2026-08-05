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
import { findEnabledModel } from '../ai/models/registry.js';
import {
  listUserOrganizations,
  createOrganization,
  findOrganizationByInviteCode,
  joinOrganization,
  getOrganizationById,
  refreshOrganizationInviteCode,
  updateOrganization,
  softDeleteOrganization,
  listOrgMembers,
  getOrgMemberWithRole,
  disableOrgMember,
  updateOrgMemberRole,
  findRoleByCode,
  transferOrganizationOwnership,
} from '../services/organization.js';
import {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  getRoleById,
} from '../services/roles.js';

export const orgRouter = Router();

export const createOrganizationInput = z.object({
  name: z.string().min(1).describe('组织名称'),
  description: z.string().optional().describe('组织描述'),
});

export const joinOrganizationInput = z.object({
  inviteCode: z.string().min(6).describe('组织邀请码'),
});

export const updateOrganizationInput = z.object({
  name: z.string().min(1).describe('组织名称'),
  description: z.string().optional().describe('组织描述'),
  aiModelDefault: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .describe('组织默认 AI 模型 ID（null 表示清除；仅所有者可修改）'),
});

export const deleteOrganizationInput = z.object({
  confirmName: z.string().describe('二次确认：需与组织名称完全一致'),
});

export const roleInput = z.object({
  name: z.string().min(1).describe('角色名称'),
  description: z.string().optional().describe('角色描述'),
  permissions: z.array(z.string()).describe('权限字符串列表'),
});

export const updateMemberRoleInput = z.object({
  roleId: z.string().describe('目标角色ID'),
});

export const transferOwnerInput = z.object({
  userId: z.string().describe('新所有者的用户ID'),
});

orgRouter.use(requireAuth);

/**
 * GET /api/organizations
 * 获取当前用户所属的组织列表
 */
orgRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    ok(res, await listUserOrganizations(req.user!.id));
  })
);

/**
 * POST /api/organizations
 * 创建新组织，当前用户自动成为所有者
 */
orgRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createOrganizationInput.parse(req.body);
    ok(res, await createOrganization({ ...input, userId: req.user!.id }));
  })
);

/**
 * POST /api/organizations/join
 * 通过邀请码加入组织
 */
orgRouter.post(
  '/join',
  asyncHandler(async (req, res) => {
    const input = joinOrganizationInput.parse(req.body);
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

/**
 * POST /api/organizations/:organizationId/refresh-invite-code
 * 刷新组织的邀请码（仅所有者可操作）
 */
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

/**
 * POST /api/organizations/:organizationId/update
 * 更新组织基本信息（需要组织管理权限；aiModelDefault 仅所有者可改）
 */
orgRouter.post(
  '/:organizationId/update',
  requireOrg,
  requirePermission(PERMISSIONS.ORG_MANAGE),
  asyncHandler(async (req, res) => {
    const input = updateOrganizationInput.parse(req.body);
    if (input.aiModelDefault !== undefined) {
      const org = await getOrganizationById(req.organizationId!);
      if (org.ownerId !== req.user!.id)
        throw new HttpError(403, '仅所有者可修改默认 AI 模型');
      if (
        input.aiModelDefault !== null &&
        !(await findEnabledModel(input.aiModelDefault))
      )
        throw new HttpError(400, '模型不存在或未启用');
    }
    ok(res, await updateOrganization(req.organizationId!, input));
  })
);

/**
 * POST /api/organizations/:organizationId/delete
 * 软删除组织（需要组织管理权限且仅所有者可操作）
 */
orgRouter.post(
  '/:organizationId/delete',
  requireOrg,
  requirePermission(PERMISSIONS.ORG_MANAGE),
  asyncHandler(async (req, res) => {
    const input = deleteOrganizationInput.parse(req.body);
    const org = await getOrganizationById(req.organizationId!);
    if (!org) throw new HttpError(404, '组织不存在');
    if (org.ownerId !== req.user!.id)
      throw new HttpError(403, '仅所有者可删除组织');
    if (org.status !== 'ACTIVE')
      throw new HttpError(400, '组织状态异常，无法删除');
    if (input.confirmName !== org.name)
      throw new HttpError(400, '二次确认不匹配');
    ok(res, await softDeleteOrganization(org.id));
  })
);

/**
 * GET /api/organizations/:organizationId/roles
 * 获取组织可用角色列表（系统角色 + 自定义角色）
 */
orgRouter.get(
  '/:organizationId/roles',
  requireOrg,
  asyncHandler(async (req, res) => {
    ok(res, await listRoles(req.organizationId!));
  })
);

/**
 * POST /api/organizations/:organizationId/roles
 * 创建组织自定义角色（需要权限 `org_role:manage`）
 */
orgRouter.post(
  '/:organizationId/roles',
  requireOrg,
  requirePermission(PERMISSIONS.ORG_ROLE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = roleInput.parse(req.body);
    ok(
      res,
      await createRole({
        organizationId: req.organizationId!,
        ...input,
      })
    );
  })
);

/**
 * POST /api/organizations/:organizationId/roles/:roleId/update
 * 更新组织自定义角色（需要权限 `org_role:manage`；系统预设角色不可编辑）
 */
orgRouter.post(
  '/:organizationId/roles/:roleId/update',
  requireOrg,
  requirePermission(PERMISSIONS.ORG_ROLE_MANAGE),
  asyncHandler(async (req, res) => {
    const roleId = req.params.roleId;
    const role = await getRoleById(roleId);
    if (!role || role.system || role.organizationId !== req.organizationId) {
      throw new HttpError(404, '角色不存在或不可编辑');
    }
    const input = roleInput.parse(req.body);
    ok(res, await updateRole(roleId, input));
  })
);

/**
 * POST /api/organizations/:organizationId/roles/:roleId/delete
 * 删除组织自定义角色（需要权限 `org_role:manage`；系统预设角色不可删除）
 */
orgRouter.post(
  '/:organizationId/roles/:roleId/delete',
  requireOrg,
  requirePermission(PERMISSIONS.ORG_ROLE_MANAGE),
  asyncHandler(async (req, res) => {
    const roleId = req.params.roleId;
    const role = await getRoleById(roleId);
    if (!role || role.system || role.organizationId !== req.organizationId) {
      throw new HttpError(404, '角色不存在或不可删除');
    }
    await deleteRole(roleId);
    ok(res, { message: '角色已删除' });
  })
);

/**
 * GET /api/organizations/:organizationId/members
 * 获取组织成员列表
 */
orgRouter.get(
  '/:organizationId/members',
  requireOrg,
  asyncHandler(async (req, res) => {
    ok(res, await listOrgMembers(req.organizationId!));
  })
);

/**
 * POST /api/organizations/:organizationId/members/:memberId/disable
 * 禁用组织成员（需要成员管理权限，所有者不可被移除）
 */
orgRouter.post(
  '/:organizationId/members/:memberId/disable',
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

/**
 * POST /api/organizations/:organizationId/members/:memberId/change-role
 * 修改组织成员角色（需要成员管理权限）
 */
orgRouter.post(
  '/:organizationId/members/:memberId/change-role',
  requireOrg,
  requirePermission(PERMISSIONS.MEMBER_MANAGE),
  asyncHandler(async (req, res) => {
    const input = updateMemberRoleInput.parse(req.body);
    const member = await getOrgMemberWithRole(req.params.memberId);
    const ownerRole = await findRoleByCode('owner');
    if (input.roleId === ownerRole.id)
      throw new HttpError(400, '请使用所有者转移功能');
    if (member.roleId === ownerRole.id)
      throw new HttpError(400, '所有者角色不可直接修改');
    ok(res, await updateOrgMemberRole(member.id, input.roleId));
  })
);

/**
 * POST /api/organizations/:organizationId/transfer-owner
 * 转移组织所有权（仅所有者可操作）
 */
orgRouter.post(
  '/:organizationId/transfer-owner',
  requireOrg,
  asyncHandler(async (req, res) => {
    const input = transferOwnerInput.parse(req.body);
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
