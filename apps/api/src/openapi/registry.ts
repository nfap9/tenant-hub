import { z } from 'zod';
import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
} from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// ==================== 公共组件 ====================

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: '登录/注册接口返回的 JWT，通过 Authorization: Bearer 传递',
});

/** 需要组织上下文的端点必须携带的 x-organization-id 请求头 */
export const organizationIdHeader = z.object({
  'x-organization-id': z.string().describe('当前组织ID'),
});

/** 登录鉴权（除注册/登录外的所有端点） */
export const bearerSecurity = [{ bearerAuth: [] }];

/** 统一错误响应体（对应 middleware/error.ts 的输出格式） */
export const errorResponseSchema = z.object({
  error: z.string().describe('错误信息'),
  details: z
    .unknown()
    .optional()
    .describe('参数校验错误详情（仅 400 可能出现）'),
});
registry.register('Error', errorResponseSchema);

const errorContent = {
  'application/json': {
    schema: { $ref: '#/components/schemas/Error' },
  },
} as const;

export const badRequestResponse = registry.registerComponent(
  'responses',
  'BadRequest',
  { description: '请求参数不正确或业务校验失败', content: errorContent }
).ref;
export const unauthorizedResponse = registry.registerComponent(
  'responses',
  'Unauthorized',
  { description: '未登录或登录凭证已失效', content: errorContent }
).ref;
export const forbiddenResponse = registry.registerComponent(
  'responses',
  'Forbidden',
  { description: '无权限执行该操作', content: errorContent }
).ref;
export const notFoundResponse = registry.registerComponent(
  'responses',
  'NotFound',
  { description: '资源不存在', content: errorContent }
).ref;
export const conflictResponse = registry.registerComponent(
  'responses',
  'Conflict',
  { description: '数据已存在，不能重复创建', content: errorContent }
).ref;

// ==================== 业务模型（概要级） ====================

export const userSchema = z
  .object({
    id: z.string().describe('用户ID'),
    phone: z.string().describe('手机号'),
    username: z.string().describe('用户名'),
    createdAt: z.string().describe('创建时间（ISO 8601）'),
  })
  .openapi('User');

export const organizationSchema = z
  .object({
    id: z.string().describe('组织ID'),
    name: z.string().describe('组织名称'),
    code: z.string().describe('组织编码'),
    description: z.string().nullable().describe('组织描述'),
    status: z.enum(['ACTIVE', 'SUSPENDED']).describe('组织状态'),
    ownerId: z.string().describe('所有者用户ID'),
    inviteCode: z.string().nullable().describe('邀请码'),
    aiModelDefault: z.string().nullable().describe('默认 AI 模型ID'),
  })
  .openapi('Organization');

export const roleSchema = z
  .object({
    id: z.string().describe('角色ID'),
    code: z.string().describe('角色编码'),
    name: z.string().describe('角色名称'),
    description: z.string().nullable().describe('角色描述'),
    system: z.boolean().describe('是否系统预设角色'),
    permissions: z.array(z.string()).describe('权限字符串列表'),
    organizationId: z
      .string()
      .nullable()
      .describe('所属组织ID（系统角色为 null）'),
  })
  .openapi('Role');

export const memberSchema = z
  .object({
    id: z.string().describe('成员ID'),
    organizationId: z.string().describe('组织ID'),
    userId: z.string().describe('用户ID'),
    roleId: z.string().describe('角色ID'),
    status: z.enum(['ACTIVE', 'INVITED', 'DISABLED']).describe('成员状态'),
    joinedAt: z.string().describe('加入时间（ISO 8601）'),
  })
  .openapi('Member');

export const apartmentSchema = z
  .object({
    id: z.string().describe('公寓ID'),
    organizationId: z.string().describe('组织ID'),
    name: z.string().describe('公寓名称'),
    address: z.string().describe('公寓地址'),
    rentAmount: z.number().describe('上游租金'),
    landlordName: z.string().nullable().describe('房东姓名'),
    landlordPhone: z.string().nullable().describe('房东联系方式'),
    contractStart: z.string().nullable().describe('合同开始日期（ISO 8601）'),
    contractEnd: z.string().nullable().describe('合同结束日期（ISO 8601）'),
    floors: z.number().nullable().describe('楼层数'),
  })
  .openapi('Apartment');

export const roomSchema = z
  .object({
    id: z.string().describe('房间ID'),
    apartmentId: z.string().describe('所属公寓ID'),
    roomNo: z.string().describe('房号'),
    floor: z.number().nullable().describe('楼层'),
    layout: z.string().describe('户型'),
    area: z.number().nullable().describe('面积（平方米）'),
    furnishings: z.array(z.string()).describe('配套设施'),
    status: z
      .enum(['VACANT', 'OCCUPIED', 'MAINTENANCE', 'SELF_USE'])
      .describe('房间状态'),
  })
  .openapi('Room');

export const leaseSchema = z
  .object({
    id: z.string().describe('租约ID'),
    organizationId: z.string().describe('组织ID'),
    roomId: z.string().describe('房间ID'),
    tenantName: z.string().nullable().describe('租户姓名'),
    tenantPhone: z.string().nullable().describe('租户手机号'),
    startDate: z.string().describe('租约开始日期（ISO 8601）'),
    endDate: z.string().describe('租约结束日期（ISO 8601）'),
    rentAmount: z.number().describe('月租金'),
    rentCycle: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).describe('付款周期'),
    waterUnitPrice: z.number().describe('水费单价'),
    powerUnitPrice: z.number().describe('电费单价'),
    depositAmount: z.number().describe('押金总额'),
    keyDepositAmount: z.number().describe('钥匙押金'),
    status: z
      .enum(['DRAFT', 'ACTIVE', 'TERMINATED', 'EXPIRED'])
      .describe('租约状态'),
  })
  .openapi('Lease');

export const billSchema = z
  .object({
    id: z.string().describe('账单ID'),
    organizationId: z.string().describe('组织ID'),
    leaseId: z.string().describe('租约ID'),
    billingDate: z.string().describe('计费日期（ISO 8601）'),
    dueDate: z.string().describe('应缴日期（ISO 8601）'),
    status: z.enum(['UNPAID', 'PAID', 'VOID', 'PENDING']).describe('账单状态'),
    totalAmount: z.number().describe('账单总额'),
    paidAmount: z.number().describe('已付金额'),
    note: z.string().nullable().describe('备注'),
  })
  .openapi('Bill');

export const paymentSchema = z
  .object({
    id: z.string().describe('收款记录ID'),
    billId: z.string().describe('账单ID'),
    userId: z.string().describe('操作人用户ID'),
    amount: z.number().describe('收款金额'),
    waiverAmount: z.number().describe('抹零金额'),
    paidAt: z.string().describe('收款时间（ISO 8601）'),
    method: z.string().describe('收款方式'),
    note: z.string().nullable().describe('备注'),
  })
  .openapi('Payment');

export const meterReadingSchema = z
  .object({
    id: z.string().describe('抄表记录ID'),
    organizationId: z.string().describe('组织ID'),
    apartmentId: z.string().describe('公寓ID'),
    roomId: z.string().describe('房间ID'),
    leaseId: z.string().nullable().describe('关联租约ID'),
    meterType: z.enum(['WATER', 'POWER']).describe('表类型'),
    readingDate: z.string().describe('抄表日期（ISO 8601）'),
    value: z.number().describe('表读数'),
    note: z.string().nullable().describe('备注'),
  })
  .openapi('MeterReading');

// ==================== 通用响应辅助 ====================

/** 构造统一 { data } 包装的成功响应 schema */
export const dataResponse = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({ data: schema });

/** 构造统一 { message } 包装的成功响应 schema */
export const messageResponse = (description: string) =>
  z.object({ message: z.string().describe(description) });
