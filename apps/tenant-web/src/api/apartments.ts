import { apiClient } from './client';
import type {
  Apartment,
  ApartmentExpense,
  LandlordContract,
  LandlordPayment,
} from '@/types/domain';

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
  return apiClient<Apartment[]>('/apartments/all', { organizationId });
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
    costElectricityPrice?: number;
    costWaterPrice?: number;
    costGasPrice?: number;
    reminderDay?: number;
    fireRating?: string;
    fireExtinguisherCount?: number;
    escapeRouteCount?: number;
    contract?: {
      contractNo?: string;
      startDate: string;
      endDate: string;
      rentAmount: number;
      depositAmount?: number;
      paymentMethod: string;
      escalationType?: string;
      escalationValue?: number;
      escalationCycle?: number;
      freeRentDays?: number;
      freeRentStart?: string;
      freeRentEnd?: string;
      signDate?: string;
      attachmentUrl?: string;
      note?: string;
    };
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
    costElectricityPrice?: number;
    costWaterPrice?: number;
    costGasPrice?: number;
    reminderDay?: number;
    fireRating?: string;
    fireExtinguisherCount?: number;
    escapeRouteCount?: number;
    contract?: {
      contractNo?: string;
      startDate?: string;
      endDate?: string;
      rentAmount?: number;
      depositAmount?: number;
      paymentMethod?: string;
      escalationType?: string;
      escalationValue?: number;
      escalationCycle?: number;
      freeRentDays?: number;
      freeRentStart?: string;
      freeRentEnd?: string;
      signDate?: string;
      attachmentUrl?: string;
      note?: string;
    };
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

export async function updateApartmentStatus(
  organizationId: string,
  id: string,
  payload: { status: string; reason?: string }
) {
  return apiClient<Apartment>(`/apartments/${id}/status`, {
    method: 'PATCH',
    body: payload,
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
    categoryId?: string;
  }
) {
  return apiClient<ApartmentExpense>(`/apartments/${apartmentId}/expenses`, {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function getApartmentDashboard(
  organizationId: string,
  apartmentId: string
) {
  return apiClient<{
    totalRooms: number;
    occupiedRooms: number;
    vacantRooms: number;
    maintenanceRooms: number;
    occupancyRate: string;
    currentMonth: {
      receivable: number;
      received: number;
      overdue: number;
    };
  }>(`/apartments/${apartmentId}/dashboard`, { organizationId });
}

export async function getApartmentOccupancyTrend(
  organizationId: string,
  apartmentId: string
) {
  return apiClient<{ month: string; occupancyRate: number }[]>(
    `/apartments/${apartmentId}/occupancy-trend`,
    { organizationId }
  );
}

export async function getApartmentRentDistribution(
  organizationId: string,
  apartmentId: string
) {
  return apiClient<{ range: string; count: number }[]>(
    `/apartments/${apartmentId}/rent-distribution`,
    { organizationId }
  );
}

export async function getApartmentStatusHistory(
  organizationId: string,
  apartmentId: string
) {
  return apiClient<
    {
      id: string;
      action: string;
      fieldName: string;
      oldValue: string;
      newValue: string;
      userId: string;
      createdAt: string;
    }[]
  >(`/apartments/${apartmentId}/status-history`, { organizationId });
}

// ===== 合同子资源 API（合并自 landlord-contracts / landlord-payments） =====

export async function getApartmentContract(
  organizationId: string,
  apartmentId: string
) {
  return apiClient<LandlordContract>(`/apartments/${apartmentId}/contract`, {
    organizationId,
  });
}

export async function updateApartmentContract(
  organizationId: string,
  apartmentId: string,
  payload: {
    contractNo?: string;
    startDate: string;
    endDate: string;
    rentAmount: number;
    depositAmount?: number;
    paymentMethod: string;
    escalationType?: string;
    escalationValue?: number;
    escalationCycle?: number;
    freeRentDays?: number;
    freeRentStart?: string;
    freeRentEnd?: string;
    signDate?: string;
    attachmentUrl?: string;
    note?: string;
  }
) {
  return apiClient<LandlordContract>(`/apartments/${apartmentId}/contract`, {
    method: 'PUT',
    body: payload,
    organizationId,
  });
}

export async function generateApartmentPaymentPlan(
  organizationId: string,
  apartmentId: string
) {
  return apiClient<{ generated: number }>(
    `/apartments/${apartmentId}/payment-plan/generate`,
    {
      method: 'POST',
      organizationId,
    }
  );
}

export async function getApartmentPayments(
  organizationId: string,
  apartmentId: string,
  status?: string
) {
  const query = status ? `?status=${status}` : '';
  return apiClient<LandlordPayment[]>(
    `/apartments/${apartmentId}/payments${query}`,
    { organizationId }
  );
}

export async function recordApartmentPayment(
  organizationId: string,
  apartmentId: string,
  paymentId: string,
  payload: {
    paidAmount: number;
    paidAt: string;
    voucherNo?: string;
    paymentMethod?: string;
    note?: string;
    createExpense?: boolean;
  }
) {
  return apiClient<LandlordPayment>(
    `/apartments/${apartmentId}/payments/${paymentId}/pay`,
    {
      method: 'POST',
      body: payload,
      organizationId,
    }
  );
}

export async function deleteApartmentPayment(
  organizationId: string,
  apartmentId: string,
  paymentId: string
) {
  return apiClient<void>(`/apartments/${apartmentId}/payments/${paymentId}`, {
    method: 'DELETE',
    organizationId,
  });
}
