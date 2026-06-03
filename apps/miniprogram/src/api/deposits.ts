import { apiClient } from './client';
import type { Deposit, DepositPayment } from '../types/domain';

export async function getDeposits(organizationId: string, status?: string) {
  const path = status ? `/deposits?status=${status}` : '/deposits';
  return apiClient<Deposit[]>(path, { organizationId });
}

export async function getDepositSummary(organizationId: string) {
  return apiClient<{
    totalAmount: number;
    paidAmount: number;
    refundedAmount: number;
    deductedAmount: number;
    pendingAmount: number;
    count: number;
  }>('/deposits/summary', { organizationId });
}

export async function getDeposit(
  organizationId: string,
  depositId: string
): Promise<Deposit> {
  return apiClient(`/deposits/${depositId}`, { organizationId });
}

export async function createDepositPayment(
  organizationId: string,
  depositId: string,
  payload: {
    type: 'COLLECT' | 'REFUND' | 'DEDUCT';
    amount: number;
    method: string;
    note?: string;
  }
) {
  return apiClient<DepositPayment>(`/deposits/${depositId}/payments`, {
    method: 'POST',
    body: payload,
    organizationId,
  });
}
