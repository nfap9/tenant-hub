import { apiClient } from './client';
import type {
  Apartment,
  ApartmentContract,
  ApartmentExpense,
} from '@/types/domain';

export async function getApartments(organizationId: string) {
  return apiClient<Apartment[]>('/apartments', { organizationId });
}

export async function createApartment(
  organizationId: string,
  payload: {
    name: string;
    location: string;
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
    location?: string;
  }
) {
  return apiClient<Apartment>(`/apartments/${id}`, {
    method: 'PUT',
    body: payload,
    organizationId,
  });
}

export async function deleteApartment(organizationId: string, id: string) {
  return apiClient<void>(`/apartments/${id}`, {
    method: 'DELETE',
    organizationId,
  });
}

export async function createApartmentExpense(
  organizationId: string,
  apartmentId: string,
  payload: {
    name: string;
    amount: number;
    spentAt: string;
    note?: string;
  }
) {
  return apiClient<ApartmentExpense>(`/apartments/${apartmentId}/expenses`, {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function getApartmentContract(
  organizationId: string,
  apartmentId: string
) {
  return apiClient<ApartmentContract | null>(
    `/apartments/${apartmentId}/contract`,
    { organizationId }
  );
}

export async function createApartmentContract(
  organizationId: string,
  apartmentId: string,
  payload: {
    landlordName?: string;
    landlordPhone?: string;
    contractStart?: string;
    contractEnd?: string;
    rentAmount?: number;
    floors?: number;
    landArea?: number;
    totalArea?: number;
  }
) {
  return apiClient<ApartmentContract>(`/apartments/${apartmentId}/contract`, {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function updateApartmentContract(
  organizationId: string,
  apartmentId: string,
  payload: {
    landlordName?: string;
    landlordPhone?: string;
    contractStart?: string;
    contractEnd?: string;
    rentAmount?: number;
    floors?: number;
    landArea?: number;
    totalArea?: number;
  }
) {
  return apiClient<ApartmentContract>(`/apartments/${apartmentId}/contract`, {
    method: 'PUT',
    body: payload,
    organizationId,
  });
}

export async function deleteApartmentContract(
  organizationId: string,
  apartmentId: string
) {
  return apiClient<void>(`/apartments/${apartmentId}/contract`, {
    method: 'DELETE',
    organizationId,
  });
}
