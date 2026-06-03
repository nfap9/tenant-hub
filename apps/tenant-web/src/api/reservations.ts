import { apiClient } from './client';
import type { Reservation } from '@/types/domain';

export async function createReservation(
  organizationId: string,
  payload: {
    roomId: string;
    name: string;
    phone: string;
    deposit?: number;
    paymentMethod?: string;
    expectedMoveInDate: string;
  }
) {
  return apiClient<Reservation>('/reservations', {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function deleteReservation(
  organizationId: string,
  roomId: string
) {
  return apiClient<void>(`/reservations/${roomId}`, {
    method: 'DELETE',
    organizationId,
  });
}

export async function getReservation(organizationId: string, roomId: string) {
  return apiClient<Reservation | null>(`/reservations/${roomId}`, {
    organizationId,
  });
}
