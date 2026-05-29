import { apiClient } from './client';
import type { Room } from '@/types/domain';

export async function getRooms(organizationId: string) {
  return apiClient<Room[]>('/apartments/rooms', { organizationId });
}

export async function getRoomDetail(organizationId: string, roomId: string) {
  return apiClient<Room>(`/apartments/rooms/${roomId}`, { organizationId });
}

export async function createRoom(
  organizationId: string,
  apartmentId: string,
  payload: {
    roomNo: string;
    floor?: number;
    layout: string;
    area?: number;
    orientation?: string;
    decorationStatus?: string;
    decorationDate?: string;
    facilities?: string[];
  }
) {
  return apiClient<{ count: number }>(
    `/apartments/${apartmentId}/rooms/batch`,
    {
      method: 'POST',
      body: { rooms: [payload] },
      organizationId,
    }
  );
}

export async function createRoomsBatch(
  organizationId: string,
  apartmentId: string,
  rooms: {
    roomNo: string;
    floor?: number;
    layout: string;
    area?: number;
    orientation?: string;
    decorationStatus?: string;
    decorationDate?: string;
    facilities?: string[];
  }[]
) {
  return apiClient<{ count: number }>(
    `/apartments/${apartmentId}/rooms/batch`,
    {
      method: 'POST',
      body: { rooms },
      organizationId,
    }
  );
}

export async function updateRoom(
  organizationId: string,
  roomId: string,
  payload: {
    roomNo?: string;
    floor?: number;
    layout?: string;
    area?: number;
    orientation?: string;
    decorationStatus?: string;
    decorationDate?: string;
    facilities?: string[];
    status?: string;
  }
) {
  return apiClient<void>(`/apartments/rooms/${roomId}`, {
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
