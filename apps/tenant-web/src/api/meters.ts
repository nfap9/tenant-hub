import { apiClient } from './client';
import type { Meter } from '@/types/domain';

export async function getMeters(
  organizationId: string,
  filters?: {
    apartmentId?: string;
    roomId?: string;
    meterType?: string;
    status?: string;
  }
) {
  const params = new URLSearchParams();
  if (filters?.apartmentId) params.set('apartmentId', filters.apartmentId);
  if (filters?.roomId) params.set('roomId', filters.roomId);
  if (filters?.meterType) params.set('meterType', filters.meterType);
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();
  return apiClient<Meter[]>(`/meters${qs ? `?${qs}` : ''}`, { organizationId });
}

export async function getMeter(organizationId: string, meterId: string) {
  return apiClient<Meter>(`/meters/${meterId}`, { organizationId });
}

export async function createMeter(
  organizationId: string,
  payload: {
    apartmentId: string;
    roomId?: string;
    name: string;
    meterType: string;
    meterNo?: string;
    parentId?: string;
  }
) {
  return apiClient<Meter>('/meters', {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function updateMeter(
  organizationId: string,
  meterId: string,
  payload: {
    name?: string;
    meterNo?: string;
    roomId?: string;
  }
) {
  return apiClient<Meter>(`/meters/${meterId}`, {
    method: 'PUT',
    body: payload,
    organizationId,
  });
}

export async function replaceMeter(
  organizationId: string,
  meterId: string,
  payload: {
    name?: string;
    meterNo?: string;
  }
) {
  return apiClient<Meter>(`/meters/${meterId}/replace`, {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function deleteMeter(organizationId: string, meterId: string) {
  return apiClient<{ success: boolean }>(`/meters/${meterId}`, {
    method: 'DELETE',
    organizationId,
  });
}
