import { apiClient } from './client';

export type Account = {
  id: string;
  name: string;
  type: 'CASH' | 'BANK' | 'WECHAT' | 'ALIPAY';
  bankName?: string;
  accountNo?: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
};

export type TransferRecord = {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  note?: string;
  createdById?: string;
  createdAt: string;
};

export async function getAccounts() {
  return apiClient<Account[]>('/accounts');
}

export async function createAccount(input: {
  name: string;
  type: 'CASH' | 'BANK' | 'WECHAT' | 'ALIPAY';
  bankName?: string;
  accountNo?: string;
}) {
  return apiClient<Account>('/accounts', {
    method: 'POST',
    body: input as Record<string, unknown>,
  });
}

export async function deleteAccount(id: string) {
  return apiClient<{ deleted: true }>(`/accounts/${id}`, {
    method: 'DELETE',
  });
}

export async function transferBetweenAccounts(input: {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  note?: string;
}) {
  return apiClient<TransferRecord>('/accounts/transfer', {
    method: 'POST',
    body: input as Record<string, unknown>,
  });
}

export async function getAllTransfers() {
  return apiClient<TransferRecord[]>('/accounts/transfers/all');
}
