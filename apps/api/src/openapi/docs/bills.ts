import { z } from 'zod';
import {
  billListQuery,
  billPaymentInput,
  generateBillsInput,
  leasePaymentInput,
  meterReadingInput,
  meterReadingListQuery,
  utilityReadingInput,
} from '../../routes/bills.js';
import {
  badRequestResponse,
  bearerSecurity,
  billSchema,
  dataResponse,
  forbiddenResponse,
  meterReadingSchema,
  notFoundResponse,
  organizationIdHeader,
  paymentSchema,
  registry,
  unauthorizedResponse,
} from '../registry.js';

const tag = '账单与抄表';

const billIdParams = z.object({ id: z.string().describe('账单ID') });

/** 账单详情/列表项：含账单项目与收款记录，从简描述 */
const billWithRelations = billSchema.extend({
  items: z.array(z.unknown()).optional().describe('账单项目列表'),
  payments: z.array(paymentSchema).optional().describe('收款记录列表'),
});

registry.registerPath({
  method: 'get',
  path: '/api/bills',
  tags: [tag],
  summary: '获取账单列表',
  description: '获取当前组织下的账单列表，可按状态筛选（需要权限 `bill:view`）',
  security: bearerSecurity,
  request: { headers: organizationIdHeader, query: billListQuery },
  responses: {
    200: {
      description: '账单列表',
      content: {
        'application/json': {
          schema: dataResponse(z.array(billWithRelations)),
        },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/bills/generate',
  tags: [tag],
  summary: '生成账单',
  description:
    '为指定租约或当前组织所有活跃租约生成账单（需要权限 `bill:manage`）',
  security: bearerSecurity,
  request: {
    headers: organizationIdHeader,
    body: { content: { 'application/json': { schema: generateBillsInput } } },
  },
  responses: {
    200: {
      description: '生成结果',
      content: {
        'application/json': {
          schema: dataResponse(
            z.object({
              leaseCount: z.number().describe('生成账单的租约数'),
              billIds: z.array(z.string()).describe('生成的账单ID列表'),
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
  method: 'get',
  path: '/api/bills/meter-readings',
  tags: [tag],
  summary: '获取抄表记录列表',
  description:
    '获取当前组织下的抄表记录列表，可按房间、公寓、表类型和日期范围筛选（需要权限 `bill:view`）',
  security: bearerSecurity,
  request: { headers: organizationIdHeader, query: meterReadingListQuery },
  responses: {
    200: {
      description: '抄表记录列表',
      content: {
        'application/json': {
          schema: dataResponse(z.array(meterReadingSchema)),
        },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/bills/meter-reading-rooms',
  tags: [tag],
  summary: '获取待抄表房间列表',
  description:
    '获取当前组织下有待抄表的房间列表，含最近一次水电读数（需要权限 `bill:view`）',
  security: bearerSecurity,
  request: { headers: organizationIdHeader },
  responses: {
    200: {
      description: '待抄表房间列表',
      content: {
        'application/json': {
          schema: dataResponse(
            z.array(z.unknown().describe('房间信息及最近一次水电读数'))
          ),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/bills/meter-readings',
  tags: [tag],
  summary: '创建抄表记录',
  description:
    '创建抄表记录，并自动尝试完成该房间待出账的后付费账单（需要权限 `bill:manage`）',
  security: bearerSecurity,
  request: {
    headers: organizationIdHeader,
    body: { content: { 'application/json': { schema: meterReadingInput } } },
  },
  responses: {
    200: {
      description: '创建成功',
      content: {
        'application/json': {
          schema: dataResponse(
            z.unknown().describe('水电抄表记录及关联出账结果')
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
  path: '/api/bills/{id}/utility-reading',
  tags: [tag],
  summary: '录入账单水电读数',
  description: '为指定账单录入水电读数并计算水电费用（需要权限 `bill:manage`）',
  security: bearerSecurity,
  request: {
    params: billIdParams,
    headers: organizationIdHeader,
    body: { content: { 'application/json': { schema: utilityReadingInput } } },
  },
  responses: {
    200: {
      description: '录入成功',
      content: {
        'application/json': { schema: dataResponse(billWithRelations) },
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
  path: '/api/bills/{id}',
  tags: [tag],
  summary: '获取账单详情',
  description: '获取指定账单的详细信息（需要权限 `bill:view`）',
  security: bearerSecurity,
  request: { params: billIdParams, headers: organizationIdHeader },
  responses: {
    200: {
      description: '账单详情',
      content: {
        'application/json': { schema: dataResponse(billWithRelations) },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/bills/{id}/retry-billing',
  tags: [tag],
  summary: '重新计算账单水电费',
  description:
    '重新根据抄表记录计算账单水电费用（需要权限 `bill:manage`；仅包含水电项目的账单可操作）',
  security: bearerSecurity,
  request: { params: billIdParams, headers: organizationIdHeader },
  responses: {
    200: {
      description: '重新出账成功',
      content: {
        'application/json': {
          schema: dataResponse(z.unknown().describe('重新出账结果')),
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
  path: '/api/bills/payments',
  tags: [tag],
  summary: '按租约记录收款',
  description:
    '为指定租约记录收款，系统自动按账期顺序销账（需要权限 `bill:manage`）',
  security: bearerSecurity,
  request: {
    headers: organizationIdHeader,
    body: { content: { 'application/json': { schema: leasePaymentInput } } },
  },
  responses: {
    200: {
      description: '收款成功',
      content: {
        'application/json': {
          schema: dataResponse(z.unknown().describe('收款及销账结果')),
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
  path: '/api/bills/{id}/payments',
  tags: [tag],
  summary: '按账单记录收款',
  description: '为指定账单记录收款（需要权限 `bill:manage`）',
  security: bearerSecurity,
  request: {
    params: billIdParams,
    headers: organizationIdHeader,
    body: { content: { 'application/json': { schema: billPaymentInput } } },
  },
  responses: {
    200: {
      description: '收款成功',
      content: {
        'application/json': {
          schema: dataResponse(z.unknown().describe('收款结果')),
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
  method: 'delete',
  path: '/api/bills/{id}',
  tags: [tag],
  summary: '删除账单',
  description:
    '删除指定账单及其付款记录（需要权限 `bill:manage`；仅未付款或金额为 0 且无实际收款的已结清账单可删除）',
  security: bearerSecurity,
  request: { params: billIdParams, headers: organizationIdHeader },
  responses: {
    200: {
      description: '删除成功',
      content: {
        'application/json': {
          schema: dataResponse(
            z.object({ deleted: z.boolean().describe('是否删除成功') })
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
  path: '/api/bills/{id}/void',
  tags: [tag],
  summary: '作废账单',
  description: '作废指定账单（需要权限 `bill:manage`）',
  security: bearerSecurity,
  request: { params: billIdParams, headers: organizationIdHeader },
  responses: {
    200: {
      description: '作废成功',
      content: {
        'application/json': { schema: dataResponse(billSchema) },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});
