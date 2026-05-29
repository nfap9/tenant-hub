import { apiClient } from './client';
import type { Apartment, ApartmentExpense } from '@/types/domain';

export async function getApartments(
  organizationId: string,
  params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    propertyType?: string;
  }
) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('pageSize', String(params.pageSize));
  if (params?.search) query.set('search', params.search);
  if (params?.status) query.set('status', params.status);
  if (params?.propertyType) query.set('propertyType', params.propertyType);
  const qs = query.toString();
  return apiClient<{
    items: Apartment[];
    total: number;
    page: number;
    pageSize: number;
  }>(`/apartments${qs ? `?${qs}` : ''}`, { organizationId });
}

export async function getApartment(organizationId: string, id: string) {
  return apiClient<Apartment>(`/apartments/${id}`, { organizationId });
}

export async function getAllApartments(organizationId: string) {
  const data = await getApartments(organizationId, {
    page: 1,
    pageSize: 1000,
  });
  return data.items;
}

export async function createApartment(
  organizationId: string,
  payload: {
    name: string;
    location: string;
    status?: string;
    propertyType?: string;
    floors?: number;
    landArea?: number;
    totalArea?: number;
    publicAreaRatio?: number;
    buildYear?: number;
    elevatorCount?: number;
    propertyRight?: string;
    landlordName?: string;
    landlordPhone?: string;
    landlordContractNo?: string;
    contractStart?: string;
    contractEnd?: string;
    rentAmount?: number;
    depositAmount?: number;
    paymentMethod?: string;
    rentEscalationType?: string;
    rentEscalationValue?: number;
    rentEscalationCycle?: number;
    costElectricityPrice?: number;
    costWaterPrice?: number;
    costGasPrice?: number;
    reminderDay?: number;
    fireRating?: string;
    fireExtinguisherCount?: number;
    escapeRouteCount?: number;
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
    status?: string;
    propertyType?: string;
    floors?: number;
    landArea?: number;
    totalArea?: number;
    publicAreaRatio?: number;
    buildYear?: number;
    elevatorCount?: number;
    propertyRight?: string;
    landlordName?: string;
    landlordPhone?: string;
    landlordContractNo?: string;
    contractStart?: string;
    contractEnd?: string;
    rentAmount?: number;
    depositAmount?: number;
    paymentMethod?: string;
    rentEscalationType?: string;
    rentEscalationValue?: number;
    rentEscalationCycle?: number;
    costElectricityPrice?: number;
    costWaterPrice?: number;
    costGasPrice?: number;
    reminderDay?: number;
    fireRating?: string;
    fireExtinguisherCount?: number;
    escapeRouteCount?: number;
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
