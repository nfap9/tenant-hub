import { apiClient } from './client';

export type AuditLog = {
  id: string;
  tableName: string;
  recordId: string;
  action: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  userId: string;
  ipAddress?: string;
  createdAt: string;
  user?: { id: string; username: string; phone: string };
};

export async function getAuditLogs(
  organizationId: string,
  params?: {
    tableName?: string;
    recordId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }
) {
  const query = params
    ? '?' +
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&')
    : '';
  return apiClient<{ items: AuditLog[]; total: number }>(
    `/audit-logs${query}`,
    { organizationId }
  );
}
