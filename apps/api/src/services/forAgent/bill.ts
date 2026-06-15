import { listBillsRaw, listMeterReadingsRaw } from '../bill.js';
import { toAgentBillSummary, toAgentMeterReading } from './mappers/index.js';

/**
 * 为智能助手查询账单列表
 * @param organizationId - 组织ID
 * @param status - 账单状态筛选（可选）
 * @param tenantName - 租客姓名筛选（可选）
 * @param mode - 账单模式筛选（可选）
 * @param limit - 返回数量限制，默认30
 * @returns 格式化后的账单列表，包含租约、房间、账单项目和付款信息
 */
export const queryBillsForAgent = async ({
  organizationId,
  status,
  tenantName,
  mode,
  limit = 30,
}: {
  organizationId: string;
  status?:
    | 'DRAFT'
    | 'BILLING'
    | 'UNPAID'
    | 'PARTIAL_PAID'
    | 'PAID'
    | 'REFUNDED'
    | 'FAILED'
    | 'VOID';
  tenantName?: string;
  mode?: 'PREPAID' | 'POSTPAID' | 'DEPOSIT';
  limit?: number;
}) => {
  const bills = await listBillsRaw(organizationId, {
    status,
    tenantName,
    mode,
    limit,
  });

  return bills.map(toAgentBillSummary);
};

/**
 * 为智能助手查询抄表记录列表
 * @param organizationId - 组织ID
 * @param roomId - 房间ID（可选）
 * @param meterType - 表类型筛选，水表或电表（可选）
 * @param limit - 返回数量限制，默认30
 * @returns 格式化后的抄表记录列表，包含房间、公寓和创建者信息
 */
export const queryMeterReadingsForAgent = async ({
  organizationId,
  roomId,
  meterType,
  limit = 30,
}: {
  organizationId: string;
  roomId?: string;
  meterType?: 'WATER' | 'POWER';
  limit?: number;
}) => {
  const readings = await listMeterReadingsRaw(organizationId, {
    roomId,
    meterType,
    limit,
  });

  return readings.map(toAgentMeterReading);
};
