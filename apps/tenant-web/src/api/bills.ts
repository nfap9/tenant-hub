import { apiClient } from './client';
import type { Bill, BillItem, MonthlyBill, Payment } from '@/types/domain';

export async function getMonthlyBills(organizationId: string) {
  return apiClient<MonthlyBill[]>('/bills/monthly', { organizationId });
}

export async function getBillsByStatus(organizationId: string, status: string) {
  return apiClient<Bill[]>(`/bills?status=${status}`, { organizationId });
}

export async function getBillDetail(organizationId: string, billId: string) {
  return apiClient<Bill>(`/bills/${billId}`, { organizationId });
}

export async function deleteMonthlyBill(organizationId: string, id: string) {
  return apiClient<void>(`/bills/monthly/${id}`, {
    method: 'DELETE',
    organizationId,
  });
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
    monthlyBillId?: string;
    billId?: string;
    amount: number;
    paidAt: string;
    method: string;
    note?: string;
  }
) {
  const path = payload.monthlyBillId
    ? `/bills/monthly/${payload.monthlyBillId}/payments`
    : `/bills/${payload.billId}/payments`;
  return apiClient<Payment>(path, {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function updateBillItem(
  organizationId: string,
  billId: string,
  itemId: string,
  payload: {
    amount?: number;
    note?: string;
  }
) {
  return apiClient<BillItem>(`/bills/${billId}/items/${itemId}`, {
    method: 'PUT',
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
