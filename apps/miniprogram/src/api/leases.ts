import { apiClient } from './client';
import type { Lease, LeaseSettlement } from '../types/domain';

export async function getLeases(organizationId: string) {
  return apiClient<Lease[]>('/leases', { organizationId });
}

export async function createLease(
  organizationId: string,
  payload: {
    roomId: string;
    tenantName: string;
    tenantPhone: string;
    startDate: string;
    endDate: string;
    cycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    rentAmount: number;
    depositAmount?: number;
    waterUnitPrice: number;
    powerUnitPrice: number;
    autoRenew?: boolean;
    status?: 'DRAFT' | 'ACTIVE';
    fees?: Array<{
      type: string;
      name: string;
      amount: number;
    }>;
    generateHistoricalBills?: boolean;
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
    fees?: Array<{
      type: string;
      name: string;
      amount: number;
    }>;
  }
) {
  return apiClient<Lease>(`/leases/${leaseId}`, {
    method: 'PUT',
    body: payload,
    organizationId,
  });
}

export async function activateLease(organizationId: string, leaseId: string) {
  return apiClient<Lease>(`/leases/${leaseId}/activate`, {
    method: 'POST',
    organizationId,
  });
}

export async function terminateLease(
  organizationId: string,
  leaseId: string,
  payload: {
    type: 'EXPIRED' | 'NEGOTIATED' | 'BREACH';
    reason?: string;
    terminatedAt?: string;
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
  return apiClient<{ netAmount: number }>(`/leases/${leaseId}/terminate`, {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function getSettlementPreview(
  organizationId: string,
  leaseId: string,
  terminatedAt?: string
) {
  const params = terminatedAt ? `?terminatedAt=${terminatedAt}` : '';
  return apiClient<{
    depositAmount: number;
    rentAdjustmentAmount: number;
    utilityAmount: number;
    otherFeeAmount: number;
    penaltyAmount: number;
    compensationAmount: number;
    receivableAmount: number;
    refundableAmount: number;
    netAmount: number;
    previousWater: number;
    currentWater: number;
    previousPower: number;
    currentPower: number;
    waterUnitPrice: number;
    powerUnitPrice: number;
  }>(`/leases/${leaseId}/settlement-preview${params}`, {
    organizationId,
  });
}

export async function getSettlements(organizationId: string) {
  return apiClient<LeaseSettlement[]>('/leases/settlements', {
    organizationId,
  });
}

export async function createSettlementPayment(
  organizationId: string,
  settlementId: string,
  payload: {
    direction: 'RECEIVE' | 'REFUND';
    amount: number;
    method: string;
    note?: string;
  }
) {
  return apiClient(`/leases/settlements/${settlementId}/payments`, {
    method: 'POST',
    body: payload,
    organizationId,
  });
}
