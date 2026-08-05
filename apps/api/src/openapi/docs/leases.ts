import { z } from 'zod';
import { createLeaseInput, updateLeaseInput } from '../../routes/leases.js';
import {
  badRequestResponse,
  bearerSecurity,
  dataResponse,
  forbiddenResponse,
  leaseSchema,
  notFoundResponse,
  organizationIdHeader,
  registry,
  unauthorizedResponse,
} from '../registry.js';

const tag = '租约';

const leaseIdParams = z.object({ id: z.string().describe('租约ID') });

/** 租约响应附带生命周期信息（到期天数、状态推导等），从简描述 */
const leaseWithLifecycle = leaseSchema.extend({
  lifecycle: z.unknown().optional().describe('租约生命周期信息'),
});

registry.registerPath({
  method: 'get',
  path: '/api/leases',
  tags: [tag],
  summary: '获取租约列表',
  description: '获取当前组织下的租约列表（需要权限 `lease:view`）',
  security: bearerSecurity,
  request: { headers: organizationIdHeader },
  responses: {
    200: {
      description: '租约列表',
      content: {
        'application/json': {
          schema: dataResponse(z.array(leaseWithLifecycle)),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/leases/{id}',
  tags: [tag],
  summary: '获取租约详情',
  description:
    '获取指定租约的详细信息（含费用、押金等关联数据；需要权限 `lease:view`）',
  security: bearerSecurity,
  request: { params: leaseIdParams, headers: organizationIdHeader },
  responses: {
    200: {
      description: '租约详情',
      content: {
        'application/json': {
          schema: dataResponse(
            leaseWithLifecycle.extend({
              fees: z.array(z.unknown()).optional().describe('附加费用列表'),
              deposits: z.array(z.unknown()).optional().describe('押金列表'),
            })
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
  method: 'post',
  path: '/api/leases',
  tags: [tag],
  summary: '创建租约',
  description:
    '创建新租约，支持草稿和直接激活，可一并处理历史账单和押金结清（需要权限 `lease:manage`）',
  security: bearerSecurity,
  request: {
    headers: organizationIdHeader,
    body: { content: { 'application/json': { schema: createLeaseInput } } },
  },
  responses: {
    200: {
      description: '创建成功',
      content: {
        'application/json': { schema: dataResponse(leaseWithLifecycle) },
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
  path: '/api/leases/{id}',
  tags: [tag],
  summary: '更新租约',
  description:
    '更新有效租约的租金、水电单价和附加费用（需要权限 `lease:manage`；仅 ACTIVE 状态可变更）',
  security: bearerSecurity,
  request: {
    params: leaseIdParams,
    headers: organizationIdHeader,
    body: { content: { 'application/json': { schema: updateLeaseInput } } },
  },
  responses: {
    200: {
      description: '更新成功',
      content: {
        'application/json': { schema: dataResponse(leaseWithLifecycle) },
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
  path: '/api/leases/{id}/activate',
  tags: [tag],
  summary: '激活租约',
  description:
    '激活草稿状态的租约并生成账单（需要权限 `lease:manage`；要求房间处于空闲状态）',
  security: bearerSecurity,
  request: { params: leaseIdParams, headers: organizationIdHeader },
  responses: {
    200: {
      description: '激活成功',
      content: {
        'application/json': { schema: dataResponse(leaseWithLifecycle) },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});
