import { apiClient } from './client';
import type { Deposit } from '@/types/domain';

export async function getDeposits(organizationId: string, status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiClient<Deposit[]>(`/deposits${query}`, { organizationId });
}

export async function getDepositSummary(organizationId: string) {
  return apiClient<{
    totalAmount: string | number;
    paidAmount: string | number;
    refundedAmount: string | number;
    deductedAmount: string | number;
    heldAmount: string | number;
    count: number;
  }>('/deposits/summary', { organizationId });
}

export async function getDepositDetail(
  organizationId: string,
  depositId: string
) {
  return apiClient<Deposit>(`/deposits/${depositId}`, { organizationId });
}
