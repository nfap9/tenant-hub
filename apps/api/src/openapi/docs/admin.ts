import { z } from 'zod';
import {
  badRequestResponse,
  bearerSecurity,
  dataResponse,
  forbiddenResponse,
  notFoundResponse,
  registry,
  roleSchema,
  unauthorizedResponse,
} from '../registry.js';

const tag = '系统管理';

const roleIdParams = z.object({
  roleId: z.string().describe('角色ID'),
});

const userIdParams = z.object({
  userId: z.string().describe('用户ID'),
});

const updatePresetRoleInput = z.object({
  name: z.string().describe('角色名称'),
  description: z.string().optional().describe('角色描述'),
  permissions: z.array(z.string()).describe('权限字符串列表'),
});

const updateSystemRoleInput = z.object({
  systemRole: z
    .enum(['SYSTEM_ADMIN', 'OPERATOR'])
    .nullable()
    .describe('系统角色（null 表示取消系统角色）'),
});

registry.registerPath({
  method: 'get',
  path: '/api/admin/preset-roles',
  tags: [tag],
  summary: '获取系统预设角色列表',
  description:
    '获取系统预设组织角色列表（需要系统权限 `system:org_role:manage`）',
  security: bearerSecurity,
  responses: {
    200: {
      description: '预设角色列表',
      content: {
        'application/json': { schema: dataResponse(z.array(roleSchema)) },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/admin/preset-roles/{roleId}/update',
  tags: [tag],
  summary: '更新系统预设角色',
  description:
    '更新系统预设组织角色的权限定义（需要系统权限 `system:org_role:manage`）',
  security: bearerSecurity,
  request: {
    params: roleIdParams,
    body: {
      content: { 'application/json': { schema: updatePresetRoleInput } },
    },
  },
  responses: {
    200: {
      description: '更新成功',
      content: {
        'application/json': { schema: dataResponse(roleSchema) },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/admin/organizations',
  tags: [tag],
  summary: '获取所有组织列表',
  description: '获取系统中所有组织列表（需要系统权限 `system:org:view`）',
  security: bearerSecurity,
  responses: {
    200: {
      description: '组织列表',
      content: {
        'application/json': { schema: dataResponse(z.array(z.unknown())) },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/admin/users',
  tags: [tag],
  summary: '获取所有用户列表',
  description: '获取系统中所有用户列表（需要系统权限 `system:user:manage`）',
  security: bearerSecurity,
  responses: {
    200: {
      description: '用户列表',
      content: {
        'application/json': { schema: dataResponse(z.array(z.unknown())) },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/admin/users/{userId}/system-role',
  tags: [tag],
  summary: '设置用户系统角色',
  description:
    '设置用户的系统角色（需要系统权限 `system:user:manage`；不能取消自己的系统管理员角色）',
  security: bearerSecurity,
  request: {
    params: userIdParams,
    body: {
      content: { 'application/json': { schema: updateSystemRoleInput } },
    },
  },
  responses: {
    200: {
      description: '设置成功',
      content: {
        'application/json': { schema: dataResponse(z.unknown()) },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});
