import { apiClient } from './client';

export type Refund = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantPhone: string;
  type: 'DEPOSIT' | 'PREPAID' | 'OVERPAY';
  amount: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  approver?: string;
  approvedAt?: string;
  note?: string;
  createdAt: string;
};

export type CreateRefundInput = {
  tenantId: string;
  type: 'DEPOSIT' | 'PREPAID' | 'OVERPAY';
  amount: number;
  reason: string;
};

export type UpdateRefundInput = {
  type?: 'DEPOSIT' | 'PREPAID' | 'OVERPAY';
  amount?: number;
  reason?: string;
};

export async function getRefunds(status?: Refund['status']) {
  const params = status ? `?status=${status}` : '';
  return apiClient<Refund[]>(`/refunds${params}`);
}

export async function createRefund(input: CreateRefundInput) {
  return apiClient<Refund>('/refunds', {
    method: 'POST',
    body: input as Record<string, unknown>,
  });
}

export async function getRefund(id: string) {
  return apiClient<Refund>(`/refunds/${id}`);
}

export async function updateRefund(id: string, input: UpdateRefundInput) {
  return apiClient<Refund>(`/refunds/${id}`, {
    method: 'PUT',
    body: input as Record<string, unknown>,
  });
}

export async function approveRefund(id: string) {
  return apiClient<Refund>(`/refunds/${id}/approve`, {
    method: 'PATCH',
  });
}

export async function rejectRefund(id: string, note: string) {
  return apiClient<Refund>(`/refunds/${id}/reject`, {
    method: 'PATCH',
    body: { note } as Record<string, unknown>,
  });
}

export async function executeRefund(id: string) {
  return apiClient<Refund>(`/refunds/${id}/execute`, {
    method: 'PATCH',
  });
}
