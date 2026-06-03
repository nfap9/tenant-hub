import { apiClient } from './client';
import type { Room } from '../types/domain';

export async function getRooms(organizationId: string) {
  return apiClient<Room[]>('/apartments/rooms', { organizationId });
}

export async function getRoom(
  organizationId: string,
  roomId: string
): Promise<Room> {
  return apiClient(`/apartments/rooms/${roomId}`, { organizationId });
}

export async function createRoom(
  organizationId: string,
  apartmentId: string,
  payload: {
    roomNo: string;
    layout: string;
    area?: number;
    facilities?: string[];
    status?: string;
  }
) {
  return apiClient<Room>(`/apartments/${apartmentId}/rooms`, {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function updateRoom(
  organizationId: string,
  roomId: string,
  payload: {
    roomNo?: string;
    layout?: string;
    area?: number;
    facilities?: string[];
    status?: 'VACANT' | 'RESERVED' | 'OCCUPIED' | 'MAINTENANCE';
  }
) {
  return apiClient<Room>(`/apartments/rooms/${roomId}`, {
    method: 'PUT',
    body: payload,
    organizationId,
  });
}

export async function deleteRoom(organizationId: string, roomId: string) {
  return apiClient<void>(`/apartments/rooms/${roomId}`, {
    method: 'DELETE',
    organizationId,
  });
}

export async function batchCreateRooms(
  organizationId: string,
  apartmentId: string,
  payload: {
    rooms: Array<{
      roomNo: string;
      layout: string;
      area?: number;
      facilities?: string[];
    }>;
  }
) {
  return apiClient<Room[]>(`/apartments/${apartmentId}/rooms/batch`, {
    method: 'POST',
    body: payload,
    organizationId,
  });
}
