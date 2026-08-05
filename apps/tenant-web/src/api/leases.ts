import { apiClient } from './client';
import type { Lease } from '@/types/domain';

export async function createLease(
  organizationId: string,
  payload: {
    roomId: string;
    tenantName?: string;
    tenantPhone?: string;
    startDate: string;
    endDate: string;
    rentCycle: string;
    rentAmount: number;
    roomDepositAmount?: number;
    keyDepositAmount?: number;
    waterUnitPrice?: number;
    powerUnitPrice?: number;
    initialWaterReading?: number;
    initialPowerReading?: number;
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
    fees?: Array<{ type: string; name: string; amount: number }>;
  }
) {
  return apiClient<Lease>(`/leases/${leaseId}/update`, {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function getLeases(organizationId: string) {
  return apiClient<Lease[]>('/leases', { organizationId });
}

export async function getLease(organizationId: string, leaseId: string) {
  return apiClient<Lease>(`/leases/${leaseId}`, { organizationId });
}

export async function activateLease(organizationId: string, leaseId: string) {
  return apiClient<Lease>(`/leases/${leaseId}/activate`, {
    method: 'POST',
    organizationId,
  });
}
