import { apiClient } from './client';
import type { Apartment, ApartmentExpense } from '@/types/domain';

export async function getApartments(organizationId: string) {
  return apiClient<Apartment[]>('/apartments', { organizationId });
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
