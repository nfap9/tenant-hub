import { apiClient } from './client';
import type { Bill, Payment } from '@/types/domain';

export async function getBills(organizationId: string) {
  return apiClient<Bill[]>('/bills', { organizationId });
}

export async function getBillsByStatus(organizationId: string, status: string) {
  return apiClient<Bill[]>(`/bills?status=${status}`, { organizationId });
}

export async function getBillDetail(organizationId: string, billId: string) {
  return apiClient<Bill>(`/bills/${billId}`, { organizationId });
}

export async function deleteBill(organizationId: string, id: string) {
  return apiClient<void>(`/bills/${id}`, { method: 'DELETE', organizationId });
}

export async function retryBillBilling(organizationId: string, billId: string) {
  return apiClient<void>(`/bills/${billId}/retry-billing`, {
    method: 'POST',
    organizationId,
  });
}

export async function createPayment(
  organizationId: string,
  payload: {
    billId: string;
    amount: number;
    paidAt: string;
    method: string;
    note?: string;
  }
) {
  return apiClient<Payment>(`/bills/${payload.billId}/payments`, {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function recordUtilityReading(
  organizationId: string,
  billId: string,
  payload: {
    previousWater?: number;
    currentWater?: number;
    previousPower?: number;
    currentPower?: number;
  }
) {
  return apiClient<void>(`/bills/${billId}/utility-reading`, {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function exportUtilityPendingCsv(organizationId: string) {
  return apiClient<string>('/bills/utility/pending-export', { organizationId });
}

export async function importUtilityCsv(
  organizationId: string,
  csvText: string
) {
  return apiClient<{ count: number }>('/bills/utility/import', {
    method: 'POST',
    body: { csv: csvText },
    organizationId,
  });
}

export async function createMeterReading(
  organizationId: string,
  payload: {
    apartmentId: string;
    roomId: string;
    leaseId?: string;
    meterType: 'WATER' | 'POWER';
    readingDate: string;
    value: number;
    note?: string;
  }
) {
  return apiClient<void>('/bills/meter-readings', {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function generateBills(
  organizationId: string,
  payload?: { leaseId?: string; today?: string }
) {
  return apiClient<{ leaseCount: number; billIds: string[] }>(
    '/bills/generate',
    {
      method: 'POST',
      body: payload ?? {},
      organizationId,
    }
  );
}

export async function voidBill(organizationId: string, billId: string) {
  return apiClient<Bill>(`/bills/${billId}/void`, {
    method: 'POST',
    organizationId,
  });
}

export async function refundBill(
  organizationId: string,
  billId: string,
  payload: { amount: number; method: string; note?: string }
) {
  return apiClient<Bill>(`/bills/${billId}/refund`, {
    method: 'POST',
    body: payload,
    organizationId,
  });
}
