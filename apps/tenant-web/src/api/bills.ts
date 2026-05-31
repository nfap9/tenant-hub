import { apiClient } from './client';
import type { Bill, Payment } from '@/types/domain';

export async function getBills(organizationId: string, type?: string) {
  const query = type ? `?type=${type}` : '';
  return apiClient<Bill[]>(`/bills${query}`, { organizationId });
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

export async function voidBill(
  organizationId: string,
  id: string,
  reason: string
) {
  return apiClient<Bill>(`/bills/${id}/status`, {
    method: 'PATCH',
    body: { status: 'VOID', reason },
    organizationId,
  });
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

export async function getMeterReadings(organizationId: string) {
  return apiClient<
    Array<{
      id: string;
      roomId: string;
      room?: { roomNo: string; apartment?: { name: string } };
      meterType: string;
      value: number | string;
      usage?: number | string;
      readingDate: string;
      source: string;
      status: string;
      note?: string;
    }>
  >('/bills/meter-readings', { organizationId });
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

export async function writeOffBill(
  organizationId: string,
  billId: string,
  reason: string
) {
  return apiClient<void>(`/bills/${billId}/write-off`, {
    method: 'PATCH',
    body: { reason },
    organizationId,
  });
}
