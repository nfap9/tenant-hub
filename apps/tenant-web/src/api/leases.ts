import { apiClient } from './client';
import type { Lease, LeaseSettlement } from '@/types/domain';

export async function createLease(
  organizationId: string,
  payload: {
    roomId: string;
    tenantName: string;
    tenantPhone: string;
    startDate: string;
    endDate: string;
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

export async function terminateLease(
  organizationId: string,
  leaseId: string,
  payload: {
    type: string;
    reason?: string;
    terminatedAt: string;
    depositDeductionAmount?: number;
    depositDeductionReason?: string;
    rentAdjustmentAmount?: number;
    currentWater?: number;
    currentPower?: number;
    otherFeeAmount?: number;
    otherFeeReason?: string;
  }
) {
  return apiClient<LeaseSettlement>(`/leases/${leaseId}/terminate`, {
    method: 'POST',
    body: payload,
    organizationId,
  });
}
