import { apiClient } from './client';

export type CoResident = {
  id: string;
  tenantId: string;
  leaseId: string;
  name: string;
  idCard?: string;
  phone?: string;
  relation: string;
  tenant?: { id: string; name: string };
  lease?: { id: string; room?: { id: string; roomNo: string } };
};

export async function getCoResidents(
  organizationId: string,
  params?: { tenantId?: string; leaseId?: string }
) {
  const query = params
    ? '?' +
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${v}`)
        .join('&')
    : '';
  return apiClient<CoResident[]>(`/co-residents${query}`, { organizationId });
}

export async function createCoResident(
  organizationId: string,
  payload: Omit<CoResident, 'id' | 'tenant' | 'lease'>
) {
  return apiClient<CoResident>('/co-residents', {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function updateCoResident(
  organizationId: string,
  id: string,
  payload: Partial<Omit<CoResident, 'id' | 'tenant' | 'lease'>>
) {
  return apiClient<CoResident>(`/co-residents/${id}`, {
    method: 'PUT',
    body: payload,
    organizationId,
  });
}

export async function deleteCoResident(organizationId: string, id: string) {
  return apiClient<void>(`/co-residents/${id}`, {
    method: 'DELETE',
    organizationId,
  });
}
