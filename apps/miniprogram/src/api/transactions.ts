import { apiClient } from './client';
import type {
  Transaction,
  TransactionCategory,
  TransactionType,
  TransactionSourceType,
} from '../types/domain';

export interface TransactionListResponse {
  items: Transaction[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TransactionSummaryResponse {
  totalIncome: string | number;
  totalExpense: string | number;
  netAmount: string | number;
  byCategory: Array<{
    category: string;
    label: string;
    income: string;
    expense: string;
  }>;
  byMethod: Array<{
    method: string;
    income: string;
    expense: string;
  }>;
  byDate: Array<{
    date: string;
    income: string;
    expense: string;
  }>;
}

export async function getTransactions(
  organizationId: string,
  params: {
    type?: TransactionType;
    category?: string;
    startDate?: string;
    endDate?: string;
    method?: string;
    apartmentId?: string;
    leaseId?: string;
    sourceType?: TransactionSourceType;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<TransactionListResponse> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  return apiClient(`/transactions?${searchParams.toString()}`, {
    organizationId,
  });
}

export async function getTransactionSummary(
  organizationId: string,
  params?: {
    startDate?: string;
    endDate?: string;
  }
): Promise<TransactionSummaryResponse> {
  const searchParams = new URLSearchParams();
  if (params?.startDate) searchParams.append('startDate', params.startDate);
  if (params?.endDate) searchParams.append('endDate', params.endDate);

  return apiClient(`/transactions/summary?${searchParams.toString()}`, {
    organizationId,
  });
}

export async function getTransactionCategories(
  organizationId: string
): Promise<TransactionCategory[]> {
  return apiClient('/transactions/categories', { organizationId });
}

export async function createTransaction(
  organizationId: string,
  data: {
    type: TransactionType;
    category: string;
    amount: number;
    method: string;
    occurredAt?: string;
    apartmentId?: string;
    note?: string;
  }
): Promise<Transaction> {
  return apiClient('/transactions', {
    method: 'POST',
    body: data,
    organizationId,
  });
}

export async function deleteTransaction(
  organizationId: string,
  id: string
): Promise<{ deleted: boolean }> {
  return apiClient(`/transactions/${id}`, {
    method: 'DELETE',
    organizationId,
  });
}
