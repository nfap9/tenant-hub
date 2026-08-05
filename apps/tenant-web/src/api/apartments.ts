import { apiClient } from './client';
import type { Apartment } from '@/types/domain';

export async function getApartments(organizationId: string) {
  return apiClient<Apartment[]>('/apartments', { organizationId });
}

export async function createApartment(
  organizationId: string,
  payload: {
    name: string;
    address: string;
    rentAmount?: number;
    landlordName?: string;
    landlordPhone?: string;
    contractStart?: string;
    contractEnd?: string;
    floors?: number;
  }
) {
  return apiClient<Apartment>('/apartments', {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function updateApartment(
  organizationId: string,
  id: string,
  payload: {
    name?: string;
    address?: string;
    rentAmount?: number;
    landlordName?: string;
    landlordPhone?: string;
    contractStart?: string;
    contractEnd?: string;
    floors?: number;
  }
) {
  return apiClient<Apartment>(`/apartments/${id}/update`, {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function deleteApartment(organizationId: string, id: string) {
  return apiClient<void>(`/apartments/${id}/delete`, {
    method: 'POST',
    organizationId,
  });
}
