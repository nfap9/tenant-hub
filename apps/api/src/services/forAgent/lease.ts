import { listLeasesRaw, listLeaseSettlementsRaw } from '../lease.js';
import {
  toAgentLeaseSummary,
  toAgentSettlementSummary,
} from './mappers/index.js';

/**
 * 为经纪人查询租约列表（支持筛选和精简字段返回）
 * @param params - 查询参数，包含组织 ID、租客姓名、房间 ID、状态及数量限制
 * @returns 精简后的租约列表（含生命周期状态及押金信息）
 */
export const queryLeasesForAgent = async ({
  organizationId,
  tenantName,
  roomId,
  status,
  limit = 30,
}: {
  organizationId: string;
  tenantName?: string;
  roomId?: string;
  status?: 'ACTIVE' | 'TERMINATED' | 'EXPIRED' | 'DRAFT';
  limit?: number;
}) => {
  const leases = await listLeasesRaw(organizationId, {
    tenantName,
    roomId,
    status,
    limit,
  });

  return leases.map(toAgentLeaseSummary);
};

/**
 * 为经纪人查询退租结算列表（支持按租约筛选和精简字段返回）
 * @param params - 查询参数，包含组织 ID、租约 ID 及数量限制
 * @returns 精简后的退租结算列表（含账单、收款汇总信息）
 */
export const querySettlementsForAgent = async ({
  organizationId,
  leaseId,
  limit = 30,
}: {
  organizationId: string;
  leaseId?: string;
  limit?: number;
}) => {
  const settlements = await listLeaseSettlementsRaw(organizationId, {
    leaseId,
    limit,
  });

  return settlements.map(toAgentSettlementSummary);
};
