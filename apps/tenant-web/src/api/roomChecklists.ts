import { apiClient } from './client';

export type RoomChecklist = {
  id: string;
  organizationId: string;
  leaseId: string;
  roomId: string;
  checkType: 'CHECKIN' | 'CHECKOUT';
  checkDate: string;
  checkedById?: string;
  tenantSignUrl?: string;
  operatorSignUrl?: string;
  note?: string;
  createdAt: string;
  lease?: {
    id: string;
    tenantName: string;
    room?: {
      id: string;
      roomNo: string;
      apartment?: { id: string; name: string };
    };
  };
  room?: { id: string; roomNo: string };
  items: RoomChecklistItem[];
};

export type RoomChecklistItem = {
  id: string;
  checklistId: string;
  category: string;
  itemName: string;
  status: string;
  description?: string;
  photoUrl?: string;
  deductionAmount?: string | number;
  note?: string;
};

export async function getRoomChecklists(
  organizationId: string,
  params?: { leaseId?: string; roomId?: string; checkType?: string }
) {
  const query = params
    ? '?' +
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${v}`)
        .join('&')
    : '';
  return apiClient<RoomChecklist[]>(`/room-checklists${query}`, {
    organizationId,
  });
}

export async function createRoomChecklist(
  organizationId: string,
  payload: Omit<
    RoomChecklist,
    'id' | 'organizationId' | 'createdAt' | 'lease' | 'room'
  >
) {
  return apiClient<RoomChecklist>('/room-checklists', {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function updateRoomChecklist(
  organizationId: string,
  id: string,
  payload: Partial<Omit<RoomChecklist, 'id' | 'createdAt' | 'lease' | 'room'>>
) {
  return apiClient<RoomChecklist>(`/room-checklists/${id}`, {
    method: 'PUT',
    body: payload,
    organizationId,
  });
}

export async function deleteRoomChecklist(organizationId: string, id: string) {
  return apiClient<void>(`/room-checklists/${id}`, {
    method: 'DELETE',
    organizationId,
  });
}
