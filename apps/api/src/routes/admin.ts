import { Router } from 'express';
import { z } from 'zod';
import type { SystemRole } from '@prisma/client';
import {
  requireAuth,
  requireSystemPermission,
} from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, ok } from '../utils/http.js';
import { prisma } from '../config/prisma.js';
import { SYSTEM_PERMISSIONS } from '../services/systemRoles.js';

export const adminRouter = Router();

adminRouter.use(requireAuth);

/**
 * GET /api/admin/preset-roles
 * 获取系统预设组织角色列表（需要 `system:org_role:manage`）
 */
adminRouter.get(
  '/preset-roles',
  requireSystemPermission(SYSTEM_PERMISSIONS.SYSTEM_ORG_ROLE_MANAGE),
  asyncHandler(async (_req, res) => {
    const roles = await prisma.role.findMany({
      where: { system: true },
      orderBy: { createdAt: 'asc' },
    });
    ok(res, roles);
  })
);

const updatePresetRoleInput = z.object({
  name: z.string().min(1).describe('角色名称'),
  description: z.string().optional().describe('角色描述'),
  permissions: z.array(z.string()).describe('权限字符串列表'),
});

/**
 * POST /api/admin/preset-roles/:roleId/update
 * 更新系统预设组织角色的权限定义（需要 `system:org_role:manage`）
 */
adminRouter.post(
  '/preset-roles/:roleId/update',
  requireSystemPermission(SYSTEM_PERMISSIONS.SYSTEM_ORG_ROLE_MANAGE),
  asyncHandler(async (req, res) => {
    const role = await prisma.role.findUnique({
      where: { id: req.params.roleId },
    });
    if (!role || !role.system) {
      throw new HttpError(404, '预设角色不存在');
    }
    const input = updatePresetRoleInput.parse(req.body);
    const updated = await prisma.role.update({
      where: { id: role.id },
      data: {
        name: input.name,
        description: input.description,
        permissions: input.permissions,
      },
    });
    ok(res, updated);
  })
);

/**
 * GET /api/admin/organizations
 * 获取所有组织列表（需要 `system:org:view`）
 */
adminRouter.get(
  '/organizations',
  requireSystemPermission(SYSTEM_PERMISSIONS.SYSTEM_ORG_VIEW),
  asyncHandler(async (req, res) => {
    const roles = await prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { members: true, apartments: true },
        },
      },
    });
    ok(res, roles);
  })
);

/**
 * GET /api/admin/users
 * 获取所有用户列表（需要 `system:user:manage`）
 */
adminRouter.get(
  '/users',
  requireSystemPermission(SYSTEM_PERMISSIONS.SYSTEM_USER_MANAGE),
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        phone: true,
        username: true,
        systemRole: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, users);
  })
);

const updateSystemRoleInput = z.object({
  systemRole: z
    .enum(['SYSTEM_ADMIN', 'OPERATOR'])
    .nullable()
    .describe('系统角色（null 表示取消系统角色）'),
});

/**
 * POST /api/admin/users/:userId/system-role
 * 设置用户的系统角色（需要 `system:user:manage`）
 */
adminRouter.post(
  '/users/:userId/system-role',
  requireSystemPermission(SYSTEM_PERMISSIONS.SYSTEM_USER_MANAGE),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const input = updateSystemRoleInput.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new HttpError(404, '用户不存在');

    // 不允许自己取消自己的系统管理员角色
    if (
      userId === req.user!.id &&
      req.user!.systemRole === 'SYSTEM_ADMIN' &&
      input.systemRole !== 'SYSTEM_ADMIN'
    ) {
      throw new HttpError(400, '不能取消自己的系统管理员角色');
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { systemRole: input.systemRole as SystemRole | null },
      select: {
        id: true,
        phone: true,
        username: true,
        systemRole: true,
      },
    });
    ok(res, updated);
  })
);
