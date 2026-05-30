import { apiClient } from './client';

export type CashierJournal = {
  id: string;
  date: string;
  type: 'INCOME' | 'EXPENSE';
  categoryId?: string;
  amount: string | number;
  paymentMethod: string;
  accountType: string;
  counterparty?: string;
  summary: string;
  operator?: { id: string; username: string };
};

export async function getCashierJournals(
  organizationId: string,
  params?: {
    type?: string;
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
        .map(([k, v]) => `${k}=${v}`)
        .join('&')
    : '';
  return apiClient<{
    items: CashierJournal[];
    total: number;
    incomeTotal: number;
    expenseTotal: number;
  }>(`/cashier-journals${query}`, { organizationId });
}

export async function createCashierJournal(
  organizationId: string,
  payload: Omit<CashierJournal, 'id' | 'operator'>
) {
  return apiClient<CashierJournal>('/cashier-journals', {
    method: 'POST',
    body: payload,
    organizationId,
  });
}

export async function getExpenseCategories(
  organizationId: string,
  type?: 'INCOME' | 'EXPENSE'
) {
  const query = type ? `?type=${type}` : '';
  return apiClient<{
    categories: Array<{
      id: string;
      name: string;
      code: string;
      type: 'INCOME' | 'EXPENSE';
    }>;
  }>(`/cashier-journals/categories${query}`, { organizationId });
}
