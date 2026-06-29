import { apiClient } from './client';
import type {
  Bill,
  Payment,
  MeterReading,
  MeterReadingRoom,
} from '@/types/domain';

export async function getBills(organizationId: string) {
  return apiClient<Bill[]>('/bills', { organizationId });
}

export async function getBillsByStatus(
  organizationId: string,
  status: 'UNPAID' | 'PAID' | 'VOID'
) {
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

export async function createLeasePayment(
  organizationId: string,
  payload: {
    leaseId: string;
    amount: number;
    waiverAmount?: number;
    paidAt: string;
    method: string;
    note?: string;
  }
) {
  return apiClient<Payment[]>('/bills/payments', {
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

export async function getMeterReadings(
  organizationId: string,
  filters?: {
    roomId?: string;
    apartmentId?: string;
    meterType?: 'WATER' | 'POWER';
    startDate?: string;
    endDate?: string;
  }
) {
  const params = new URLSearchParams();
  if (filters?.roomId) params.set('roomId', filters.roomId);
  if (filters?.apartmentId) params.set('apartmentId', filters.apartmentId);
  if (filters?.meterType) params.set('meterType', filters.meterType);
  if (filters?.startDate) params.set('startDate', filters.startDate);
  if (filters?.endDate) params.set('endDate', filters.endDate);
  const query = params.toString();
  return apiClient<MeterReading[]>(
    `/bills/meter-readings${query ? `?${query}` : ''}`,
    { organizationId }
  );
}

export async function getMeterReadingRooms(organizationId: string) {
  return apiClient<MeterReadingRoom[]>('/bills/meter-reading-rooms', {
    organizationId,
  });
}

export async function createMeterReading(
  organizationId: string,
  payload: {
    roomId: string;
    readingDate: string;
    waterValue: number;
    powerValue: number;
    note?: string;
  }
) {
  return apiClient<{ waterReading: MeterReading; powerReading: MeterReading }>(
    '/bills/meter-readings',
    {
      method: 'POST',
      body: payload,
      organizationId,
    }
  );
}

export async function recordUtilityReading(
  organizationId: string,
  billId: string,
  payload: {
    previousWater: number;
    currentWater: number;
    previousPower: number;
    currentPower: number;
  }
) {
  return apiClient<Bill>(`/bills/${billId}/utility-reading`, {
    method: 'POST',
    body: payload,
    organizationId,
  });
}
