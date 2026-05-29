import { apiClient } from './client';

export type LandlordContract = {
  id: string;
  apartmentId: string;
  contractNo?: string;
  startDate: string;
  endDate: string;
  rentAmount: string | number;
  depositAmount: string | number;
  paymentMethod: string;
  escalationType?: string;
  escalationValue?: string | number;
  escalationCycle?: number;
  freeRentDays: number;
  freeRentStart?: string;
  freeRentEnd?: string;
  signDate?: string;
  attachmentUrl?: string;
  note?: string;
  isActive: boolean;
  createdAt: string;
  apartment?: { id: string; name: string };
};

export async function getLandlordContracts(
  organizationId: string,
  apartmentId?: string
) {
  const query = apartmentId ? `?apartmentId=${apartmentId}` : '';
  return apiClient<LandlordContract[]>(`/landlord-contracts${query}`, {
    organizationId,
  });
}

export async function createLandlordContract(
  organizationId: string,
  payload: Omit<LandlordContract, 'id' | 'createdAt' | 'apartment'>
) {
  return apiClient<LandlordContract>('/landlord-contracts', {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function updateLandlordContract(
  organizationId: string,
  id: string,
  payload: Partial<Omit<LandlordContract, 'id' | 'createdAt' | 'apartment'>>
) {
  return apiClient<LandlordContract>(`/landlord-contracts/${id}`, {
    method: 'PUT',
    body: payload,
    organizationId,
  });
}

export async function deleteLandlordContract(
  organizationId: string,
  id: string
) {
  return apiClient<void>(`/landlord-contracts/${id}`, {
    method: 'DELETE',
    organizationId,
  });
}
