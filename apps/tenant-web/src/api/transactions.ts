import { apiClient } from './client';
import type {
  Transaction,
  TransactionType,
  TransactionSourceType,
} from '@/types/domain';

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

export interface TransactionCategory {
  key: string;
  label: string;
  type: TransactionType;
}

export const getTransactions = async (params: {
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
}): Promise<TransactionListResponse> => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  return apiClient(`/transactions?${searchParams.toString()}`);
};

export const getTransactionSummary = async (params?: {
  startDate?: string;
  endDate?: string;
}): Promise<TransactionSummaryResponse> => {
  const searchParams = new URLSearchParams();
  if (params?.startDate) searchParams.append('startDate', params.startDate);
  if (params?.endDate) searchParams.append('endDate', params.endDate);

  return apiClient(`/transactions/summary?${searchParams.toString()}`);
};

export const getTransactionCategories = async (): Promise<
  TransactionCategory[]
> => {
  return apiClient('/transactions/categories');
};

export const createTransaction = async (data: {
  type: TransactionType;
  category: string;
  amount: number;
  method: string;
  occurredAt?: string;
  apartmentId?: string;
  note?: string;
}): Promise<Transaction> => {
  return apiClient('/transactions', { method: 'POST', body: data });
};

export const deleteTransaction = async (
  id: string
): Promise<{ deleted: boolean }> => {
  return apiClient(`/transactions/${id}`, { method: 'DELETE' });
};
