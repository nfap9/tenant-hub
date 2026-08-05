import { z } from 'zod';
import {
  createOrganizationInput,
  deleteOrganizationInput,
  joinOrganizationInput,
  roleInput,
  transferOwnerInput,
  updateMemberRoleInput,
  updateOrganizationInput,
} from '../../routes/organizations.js';
import {
  badRequestResponse,
  bearerSecurity,
  conflictResponse,
  dataResponse,
  forbiddenResponse,
  memberSchema,
  messageResponse,
  notFoundResponse,
  organizationIdHeader,
  organizationSchema,
  registry,
  roleSchema,
  unauthorizedResponse,
} from '../registry.js';

const tag = '组织';

/** 带组织 ID 的路径参数 */
const orgIdParams = z.object({
  organizationId: z.string().describe('组织ID'),
});
const orgRoleParams = orgIdParams.extend({
  roleId: z.string().describe('角色ID'),
});
const orgMemberParams = orgIdParams.extend({
  memberId: z.string().describe('成员ID'),
});

registry.registerPath({
  method: 'get',
  path: '/api/organizations',
  tags: [tag],
  summary: '获取我的组织列表',
  description: '获取当前用户所属的组织列表',
  security: bearerSecurity,
  responses: {
    200: {
      description: '组织列表',
      content: {
        'application/json': {
          schema: dataResponse(z.array(organizationSchema)),
        },
      },
    },
    401: unauthorizedResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/organizations',
  tags: [tag],
  summary: '创建组织',
  description: '创建新组织，当前用户自动成为所有者',
  security: bearerSecurity,
  request: {
    body: {
      content: { 'application/json': { schema: createOrganizationInput } },
    },
  },
  responses: {
    200: {
      description: '创建成功',
      content: {
        'application/json': { schema: dataResponse(organizationSchema) },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/organizations/join',
  tags: [tag],
  summary: '通过邀请码加入组织',
  description: '通过邀请码加入组织',
  security: bearerSecurity,
  request: {
    body: {
      content: { 'application/json': { schema: joinOrganizationInput } },
    },
  },
  responses: {
    200: {
      description: '加入成功',
      content: {
        'application/json': {
          schema: dataResponse(
            z.object({
              organization: organizationSchema,
              member: memberSchema,
            })
          ),
        },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/organizations/{organizationId}/refresh-invite-code',
  tags: [tag],
  summary: '刷新组织邀请码',
  description: '刷新组织的邀请码（仅所有者可操作）',
  security: bearerSecurity,
  request: { params: orgIdParams, headers: organizationIdHeader },
  responses: {
    200: {
      description: '新的邀请码',
      content: {
        'application/json': {
          schema: dataResponse(
            z.object({ inviteCode: z.string().nullable().describe('邀请码') })
          ),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/organizations/{organizationId}',
  tags: [tag],
  summary: '更新组织信息',
  description:
    '更新组织基本信息（需要权限 `org:manage`；aiModelDefault 仅所有者可修改）',
  security: bearerSecurity,
  request: {
    params: orgIdParams,
    headers: organizationIdHeader,
    body: {
      content: { 'application/json': { schema: updateOrganizationInput } },
    },
  },
  responses: {
    200: {
      description: '更新成功',
      content: {
        'application/json': { schema: dataResponse(organizationSchema) },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/organizations/{organizationId}',
  tags: [tag],
  summary: '删除组织',
  description:
    '软删除组织（需要权限 `org:manage` 且仅所有者可操作，需输入组织名称二次确认）',
  security: bearerSecurity,
  request: {
    params: orgIdParams,
    headers: organizationIdHeader,
    body: {
      content: { 'application/json': { schema: deleteOrganizationInput } },
    },
  },
  responses: {
    200: {
      description: '删除成功',
      content: {
        'application/json': {
          schema: dataResponse(z.unknown().describe('删除结果')),
        },
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
  path: '/api/organizations/{organizationId}/roles',
  tags: [tag],
  summary: '获取角色列表',
  description: '获取组织可用角色列表（系统角色 + 自定义角色）',
  security: bearerSecurity,
  request: { params: orgIdParams, headers: organizationIdHeader },
  responses: {
    200: {
      description: '角色列表',
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
  path: '/api/organizations/{organizationId}/roles',
  tags: [tag],
  summary: '创建自定义角色',
  description: '创建组织自定义角色（需要权限 `org:manage`）',
  security: bearerSecurity,
  request: {
    params: orgIdParams,
    headers: organizationIdHeader,
    body: { content: { 'application/json': { schema: roleInput } } },
  },
  responses: {
    200: {
      description: '创建成功',
      content: {
        'application/json': { schema: dataResponse(roleSchema) },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/organizations/{organizationId}/roles/{roleId}',
  tags: [tag],
  summary: '更新自定义角色',
  description: '更新组织自定义角色（需要权限 `org:manage`；系统角色不可编辑）',
  security: bearerSecurity,
  request: {
    params: orgRoleParams,
    headers: organizationIdHeader,
    body: { content: { 'application/json': { schema: roleInput } } },
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
  method: 'delete',
  path: '/api/organizations/{organizationId}/roles/{roleId}',
  tags: [tag],
  summary: '删除自定义角色',
  description:
    '删除组织自定义角色（需要权限 `org:manage`；系统角色及仍被成员使用的角色不可删除）',
  security: bearerSecurity,
  request: { params: orgRoleParams, headers: organizationIdHeader },
  responses: {
    200: {
      description: '删除成功',
      content: {
        'application/json': { schema: messageResponse('操作结果提示') },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/organizations/{organizationId}/members',
  tags: [tag],
  summary: '获取成员列表',
  description: '获取组织成员列表（含用户与角色信息）',
  security: bearerSecurity,
  request: { params: orgIdParams, headers: organizationIdHeader },
  responses: {
    200: {
      description: '成员列表',
      content: {
        'application/json': {
          schema: dataResponse(
            z.array(
              memberSchema.extend({
                user: z.unknown().describe('用户信息'),
                role: roleSchema,
              })
            )
          ),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/organizations/{organizationId}/members/{memberId}',
  tags: [tag],
  summary: '禁用组织成员',
  description: '禁用组织成员（需要权限 `member:manage`，所有者不可被移除）',
  security: bearerSecurity,
  request: { params: orgMemberParams, headers: organizationIdHeader },
  responses: {
    200: {
      description: '禁用成功',
      content: {
        'application/json': { schema: dataResponse(memberSchema) },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/organizations/{organizationId}/members/{memberId}/role',
  tags: [tag],
  summary: '修改成员角色',
  description:
    '修改组织成员角色（需要权限 `member:manage`；所有者角色请使用所有者转移功能）',
  security: bearerSecurity,
  request: {
    params: orgMemberParams,
    headers: organizationIdHeader,
    body: {
      content: { 'application/json': { schema: updateMemberRoleInput } },
    },
  },
  responses: {
    200: {
      description: '修改成功',
      content: {
        'application/json': { schema: dataResponse(memberSchema) },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/organizations/{organizationId}/transfer-owner',
  tags: [tag],
  summary: '转移组织所有权',
  description: '转移组织所有权（仅所有者可操作）',
  security: bearerSecurity,
  request: {
    params: orgIdParams,
    headers: organizationIdHeader,
    body: {
      content: { 'application/json': { schema: transferOwnerInput } },
    },
  },
  responses: {
    200: {
      description: '转移成功',
      content: {
        'application/json': { schema: messageResponse('操作结果提示') },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    409: conflictResponse,
  },
});
