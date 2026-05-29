import { apiClient } from './client';
import type { Bill, Lease, LeaseSettlement } from '@/types/domain';

export async function createLease(
  organizationId: string,
  payload: {
    roomId: string;
    tenantId?: string;
    tenantName: string;
    tenantPhone: string;
    startDate: string;
    endDate: string;
    billDay?: number;
    graceDays?: number;
    cycle: string;
    rentAmount: number;
    depositAmount?: number;
    waterUnitPrice?: number;
    powerUnitPrice?: number;
    autoRenew?: boolean;
    generateHistoricalBills?: boolean;
    fees?: Array<{ type: string; name: string; amount: number }>;
  }
) {
  return apiClient<Lease>('/leases', {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function updateLease(
  organizationId: string,
  leaseId: string,
  payload: {
    rentAmount?: number;
    depositAmount?: number;
    waterUnitPrice?: number;
    powerUnitPrice?: number;
    billDay?: number;
    fees?: Array<{ type: string; name: string; amount: number }>;
  }
) {
  return apiClient<Lease>(`/leases/${leaseId}`, {
    method: 'PUT',
    body: payload,
    organizationId,
  });
}

export async function getSettlementPreview(
  organizationId: string,
  leaseId: string,
  terminatedAt: string
) {
  return apiClient<{
    previousWater: string | number;
    previousPower: string | number;
  }>(
    `/leases/${leaseId}/settlement-preview?terminatedAt=${encodeURIComponent(terminatedAt)}`,
    { organizationId }
  );
}

export async function getLeases(organizationId: string) {
  return apiClient<Lease[]>('/leases', { organizationId });
}

export async function renewLease(
  organizationId: string,
  leaseId: string,
  payload: {
    startDate: string;
    endDate: string;
    rentAmount?: number;
    remark?: string;
  }
) {
  return apiClient<Lease>(`/leases/${leaseId}/renew`, {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function roomChange(
  organizationId: string,
  leaseId: string,
  payload: {
    newRoomId: string;
    startDate: string;
    endDate: string;
    rentAmount?: number;
    remark?: string;
  }
) {
  return apiClient<Lease>(`/leases/${leaseId}/room-change`, {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function terminateLease(
  organizationId: string,
  leaseId: string,
  payload: {
    type: string;
    reason?: string;
    terminatedAt: string;
    rentAdjustmentAmount?: number;
    currentWater?: number;
    currentPower?: number;
    otherFeeAmount?: number;
    otherFeeReason?: string;
    penaltyAmount?: number;
    penaltyReason?: string;
    compensationAmount?: number;
    compensationReason?: string;
  }
) {
  return apiClient<{
    settlement: LeaseSettlement;
    settlementBill: Bill | null;
  }>(`/leases/${leaseId}/terminate`, {
    method: 'POST',
    body: payload,
    organizationId,
  });
}
