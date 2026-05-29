import { apiClient } from './client';
import type { Tenant, AccountTransaction } from '@/types/domain';

export async function getTenants(organizationId: string) {
  return apiClient<Tenant[]>('/tenants', { organizationId });
}

export async function searchTenants(
  organizationId: string,
  query: { phone?: string; name?: string }
) {
  const params = new URLSearchParams();
  if (query.phone) params.set('phone', query.phone);
  if (query.name) params.set('name', query.name);
  return apiClient<Tenant[]>(`/tenants/search?${params.toString()}`, {
    organizationId,
  });
}

export async function getTenant(organizationId: string, tenantId: string) {
  return apiClient<Tenant>(`/tenants/${tenantId}`, { organizationId });
}

export async function updateTenant(
  organizationId: string,
  tenantId: string,
  payload: {
    name?: string;
    phone?: string;
    idCard?: string;
    idCardFrontUrl?: string;
    idCardBackUrl?: string;
    workUnit?: string;
    jobTitle?: string;
    emergencyContact?: string;
    emergencyPhone?: string;
    sourceChannel?: string;
    creditScore?: number;
    remark?: string;
  }
) {
  return apiClient<Tenant>(`/tenants/${tenantId}`, {
    method: 'PUT',
    body: payload,
    organizationId,
  });
}

export async function deleteTenant(organizationId: string, tenantId: string) {
  return apiClient<{ success: boolean }>(`/tenants/${tenantId}`, {
    method: 'DELETE',
    organizationId,
  });
}

export async function getTenantAccount(
  organizationId: string,
  tenantId: string
) {
  return apiClient<{
    prepaidBalance: string | number;
    depositBalance: string | number;
    totalUnpaid: string | number;
    netBalance: string | number;
  }>(`/tenants/${tenantId}/account`, { organizationId });
}

export async function getTenantAccountTransactions(
  organizationId: string,
  tenantId: string,
  page = 1,
  pageSize = 20
) {
  return apiClient<{ items: AccountTransaction[]; total: number }>(
    `/tenants/${tenantId}/account/transactions?page=${page}&pageSize=${pageSize}`,
    { organizationId }
  );
}

export async function adjustTenantAccount(
  organizationId: string,
  tenantId: string,
  payload: { amount: number; note?: string }
) {
  return apiClient<AccountTransaction>(`/tenants/${tenantId}/account/adjust`, {
    method: 'POST',
    body: payload,
    organizationId,
  });
}
