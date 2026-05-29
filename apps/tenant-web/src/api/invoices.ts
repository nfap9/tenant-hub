import { apiClient } from './client';

export type Invoice = {
  id: string;
  tenantId?: string;
  billId?: string;
  title: string;
  taxNo?: string;
  amount: string | number;
  content?: string;
  email?: string;
  address?: string;
  status: string;
  createdAt: string;
};

export async function getInvoices(organizationId: string, status?: string) {
  const query = status ? `?status=${status}` : '';
  return apiClient<Invoice[]>(`/invoices${query}`, { organizationId });
}

export async function createInvoice(
  organizationId: string,
  payload: Omit<Invoice, 'id' | 'createdAt'>
) {
  return apiClient<Invoice>('/invoices', {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function updateInvoiceStatus(
  organizationId: string,
  id: string,
  payload: {
    status: string;
    issuedAt?: string;
    sentAt?: string;
    receivedAt?: string;
  }
) {
  return apiClient<Invoice>(`/invoices/${id}/status`, {
    method: 'PATCH',
    body: payload,
    organizationId,
  });
}
