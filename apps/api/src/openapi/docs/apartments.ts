import { z } from 'zod';
import {
  apartmentInput,
  batchCreateRoomsInput,
  updateRoomInput,
} from '../../routes/apartments.js';
import {
  apartmentSchema,
  badRequestResponse,
  bearerSecurity,
  dataResponse,
  forbiddenResponse,
  notFoundResponse,
  organizationIdHeader,
  registry,
  roomSchema,
  unauthorizedResponse,
} from '../registry.js';

const tag = '公寓与房间';

const apartmentIdParams = z.object({ id: z.string().describe('公寓ID') });
const roomIdParams = z.object({ roomId: z.string().describe('房间ID') });

/** 公寓列表项：含房间、活跃租约及本月账单状态（嵌套结构从简） */
const apartmentWithRooms = apartmentSchema.extend({
  rooms: z.array(z.unknown()).describe('房间列表（含活跃租约及本月账单状态）'),
});

/** 房间详情：含活跃租约及本月账单状态 */
const roomWithLeases = roomSchema.extend({
  leases: z
    .array(z.unknown())
    .describe('活跃租约列表（含生命周期与本月账单状态）'),
});

registry.registerPath({
  method: 'get',
  path: '/api/apartments',
  tags: [tag],
  summary: '获取公寓列表',
  description:
    '获取当前组织下的公寓列表（含房间、租约及本月账单状态；需要权限 `apartment:view`）',
  security: bearerSecurity,
  request: { headers: organizationIdHeader },
  responses: {
    200: {
      description: '公寓列表',
      content: {
        'application/json': {
          schema: dataResponse(z.array(apartmentWithRooms)),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/apartments/rooms',
  tags: [tag],
  summary: '获取房间列表',
  description:
    '获取当前组织下的房间列表（含活跃租约及本月账单状态；需要权限 `room:view`）',
  security: bearerSecurity,
  request: { headers: organizationIdHeader },
  responses: {
    200: {
      description: '房间列表',
      content: {
        'application/json': {
          schema: dataResponse(z.array(roomWithLeases)),
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/apartments',
  tags: [tag],
  summary: '创建公寓',
  description: '在当前组织下创建新公寓（需要权限 `apartment:manage`）',
  security: bearerSecurity,
  request: {
    headers: organizationIdHeader,
    body: { content: { 'application/json': { schema: apartmentInput } } },
  },
  responses: {
    200: {
      description: '创建成功',
      content: {
        'application/json': { schema: dataResponse(apartmentSchema) },
      },
    },
    400: badRequestResponse,
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/apartments/{id}',
  tags: [tag],
  summary: '更新公寓',
  description: '更新指定公寓的基本信息（需要权限 `apartment:manage`）',
  security: bearerSecurity,
  request: {
    params: apartmentIdParams,
    headers: organizationIdHeader,
    body: {
      content: { 'application/json': { schema: apartmentInput.partial() } },
    },
  },
  responses: {
    200: {
      description: '更新成功',
      content: {
        'application/json': { schema: dataResponse(apartmentSchema) },
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
  path: '/api/apartments/{id}',
  tags: [tag],
  summary: '删除公寓',
  description:
    '删除指定公寓（需要权限 `apartment:manage`；存在活跃租约时禁止删除）',
  security: bearerSecurity,
  request: { params: apartmentIdParams, headers: organizationIdHeader },
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
  method: 'post',
  path: '/api/apartments/{id}/rooms/batch',
  tags: [tag],
  summary: '批量创建房间',
  description: '批量为指定公寓创建房间（自动去重；需要权限 `room:manage`）',
  security: bearerSecurity,
  request: {
    params: apartmentIdParams,
    headers: organizationIdHeader,
    body: {
      content: { 'application/json': { schema: batchCreateRoomsInput } },
    },
  },
  responses: {
    200: {
      description: '创建成功',
      content: {
        'application/json': { schema: dataResponse(z.array(roomSchema)) },
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
  path: '/api/apartments/rooms/{roomId}',
  tags: [tag],
  summary: '更新房间',
  description:
    '更新指定房间的信息和状态（需要权限 `room:manage`；已出租房间不可直接设为空闲，需走退租流程）',
  security: bearerSecurity,
  request: {
    params: roomIdParams,
    headers: organizationIdHeader,
    body: { content: { 'application/json': { schema: updateRoomInput } } },
  },
  responses: {
    200: {
      description: '更新成功',
      content: {
        'application/json': { schema: dataResponse(roomSchema) },
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
  path: '/api/apartments/rooms/{roomId}',
  tags: [tag],
  summary: '获取房间详情',
  description: '获取指定房间的详细信息（需要权限 `room:view`）',
  security: bearerSecurity,
  request: { params: roomIdParams, headers: organizationIdHeader },
  responses: {
    200: {
      description: '房间详情',
      content: {
        'application/json': { schema: dataResponse(roomWithLeases) },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/apartments/rooms/{roomId}',
  tags: [tag],
  summary: '删除房间',
  description: '删除指定房间（需要权限 `room:manage`；存在活跃租约时禁止删除）',
  security: bearerSecurity,
  request: { params: roomIdParams, headers: organizationIdHeader },
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
