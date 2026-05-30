import { apiClient } from './client';

export type LandlordPayment = {
  id: string;
  organizationId: string;
  landlordContractId: string;
  apartmentId: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  plannedAmount: string | number;
  paidAmount?: string | number;
  paidAt?: string;
  voucherNo?: string;
  paymentMethod?: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  expenseId?: string;
  note?: string;
  createdAt: string;
  landlordContract?: { id: string; contractNo: string };
  apartment?: { id: string; name: string };
  expense?: { id: string; name: string; amount: string | number };
};

export async function getLandlordPayments(
  organizationId: string,
  params?: {
    contractId?: string;
    apartmentId?: string;
    status?: string;
  }
) {
  const query = params
    ? '?' +
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${v}`)
        .join('&')
    : '';
  return apiClient<LandlordPayment[]>(`/landlord-payments${query}`, {
    organizationId,
  });
}

export async function getLandlordPayment(organizationId: string, id: string) {
  return apiClient<LandlordPayment>(`/landlord-payments/${id}`, {
    organizationId,
  });
}

export async function generateLandlordPayments(
  organizationId: string,
  landlordContractId: string
) {
  return apiClient<{ generated: number }>('/landlord-payments/generate', {
    method: 'POST',
    body: { landlordContractId },
    organizationId,
  });
}

export async function recordLandlordPayment(
  organizationId: string,
  id: string,
  payload: {
    paidAmount: number;
    paidAt: string;
    voucherNo?: string;
    paymentMethod?: string;
    note?: string;
    createExpense?: boolean;
  }
) {
  return apiClient<LandlordPayment>(`/landlord-payments/${id}/pay`, {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function deleteLandlordPayment(
  organizationId: string,
  id: string
) {
  return apiClient<void>(`/landlord-payments/${id}`, {
    method: 'DELETE',
    organizationId,
  });
}
