import { apiClient } from './client';

export type MaintenanceOrder = {
  id: string;
  organizationId: string;
  apartmentId?: string;
  roomId?: string;
  type: string;
  priority: 'URGENT' | 'NORMAL' | 'LOW';
  title: string;
  description?: string;
  reporterName?: string;
  reporterPhone?: string;
  scheduledDate?: string;
  completedDate?: string;
  materialCost: string | number;
  laborCost: string | number;
  totalCost: string | number;
  status: string;
  assignedTo?: string;
  acceptanceNote?: string;
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
  isTenantFault: boolean;
  createdAt: string;
  apartment?: { id: string; name: string };
  room?: { id: string; roomNo: string };
  items?: MaintenanceOrderItem[];
};

export type MaintenanceOrderItem = {
  id: string;
  maintenanceOrderId: string;
  name: string;
  quantity: number;
  unitPrice: string | number;
  amount: string | number;
  isLabor: boolean;
};

export async function getMaintenanceOrders(
  organizationId: string,
  status?: string
) {
  const query = status ? `?status=${status}` : '';
  return apiClient<MaintenanceOrder[]>(`/maintenance${query}`, {
    organizationId,
  });
}

export async function createMaintenanceOrder(
  organizationId: string,
  payload: Omit<
    MaintenanceOrder,
    'id' | 'createdAt' | 'apartment' | 'room' | 'items'
  >
) {
  return apiClient<MaintenanceOrder>('/maintenance', {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function updateMaintenanceOrder(
  organizationId: string,
  id: string,
  payload: Partial<
    Omit<MaintenanceOrder, 'id' | 'createdAt' | 'apartment' | 'room' | 'items'>
  >
) {
  return apiClient<MaintenanceOrder>(`/maintenance/${id}`, {
    method: 'PUT',
    body: payload,
    organizationId,
  });
}

export async function updateMaintenanceOrderStatus(
  organizationId: string,
  id: string,
  payload: {
    status: string;
    assignedTo?: string;
    acceptanceNote?: string;
    materialCost?: number;
    laborCost?: number;
    totalCost?: number;
    isTenantFault?: boolean;
  }
) {
  return apiClient<MaintenanceOrder>(`/maintenance/${id}/status`, {
    method: 'PATCH',
    body: payload,
    organizationId,
  });
}

export async function deleteMaintenanceOrder(
  organizationId: string,
  id: string
) {
  return apiClient<void>(`/maintenance/${id}`, {
    method: 'DELETE',
    organizationId,
  });
}
