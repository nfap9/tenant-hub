import { apiClient } from './client';
import type { Bill, MeterReading, MonthlyBill } from '../types/domain';

export async function getBills(
  organizationId: string,
  status?: string
): Promise<Bill[]> {
  const path = status ? `/bills?status=${status}` : '/bills';
  return apiClient(path, { organizationId });
}

export async function getBill(
  organizationId: string,
  billId: string
): Promise<Bill> {
  return apiClient(`/bills/${billId}`, { organizationId });
}

export async function generateBills(
  organizationId: string,
  payload?: {
    leaseId?: string;
    today?: string;
  }
): Promise<void> {
  return apiClient('/bills/generate', {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function retryBilling(organizationId: string, billId: string) {
  return apiClient(`/bills/${billId}/retry-billing`, {
    method: 'POST',
    organizationId,
  });
}

export async function deleteBill(organizationId: string, billId: string) {
  return apiClient<void>(`/bills/${billId}`, {
    method: 'DELETE',
    organizationId,
  });
}

export async function voidBill(organizationId: string, billId: string) {
  return apiClient(`/bills/${billId}/void`, {
    method: 'POST',
    organizationId,
  });
}

export async function createBillPayment(
  organizationId: string,
  billId: string,
  payload: {
    amount: number;
    method: string;
    note?: string;
  }
) {
  return apiClient(`/bills/${billId}/payments`, {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function refundBill(
  organizationId: string,
  billId: string,
  payload: {
    amount: number;
    method: string;
    note?: string;
  }
) {
  return apiClient(`/bills/${billId}/refund`, {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function getMeterReadings(
  organizationId: string,
  roomId?: string
) {
  const path = roomId
    ? `/bills/meter-readings?roomId=${roomId}`
    : '/bills/meter-readings';
  return apiClient<MeterReading[]>(path, { organizationId });
}

export async function createMeterReading(
  organizationId: string,
  payload: {
    roomId: string;
    meterType: 'WATER' | 'POWER';
    readingDate: string;
    value: number;
    note?: string;
  }
) {
  return apiClient<MeterReading>('/bills/meter-readings', {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function createUtilityReading(
  organizationId: string,
  billId: string,
  payload: {
    previousWater?: number;
    currentWater: number;
    previousPower?: number;
    currentPower: number;
  }
) {
  return apiClient(`/bills/${billId}/utility-reading`, {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function getUtilityPendingExport(organizationId: string) {
  return apiClient<
    Array<{
      billId: string;
      roomNo: string;
      tenantName: string;
      previousWater: number;
      currentWater: number;
      previousPower: number;
      currentPower: number;
    }>
  >('/bills/utility/pending-export', { organizationId });
}

export async function importUtilityReadings(
  organizationId: string,
  payload: {
    csv?: string;
    rows?: Array<{
      billId: string;
      previousWater: number;
      currentWater: number;
      previousPower: number;
      currentPower: number;
    }>;
  }
) {
  return apiClient('/bills/utility/import', {
    method: 'POST',
    body: payload,
    organizationId,
  });
}
