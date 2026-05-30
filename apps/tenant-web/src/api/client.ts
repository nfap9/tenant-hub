const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown> | FormData;
  headers?: Record<string, string>;
  organizationId?: string;
};

import { getSession, getOrgId, clearSession } from '@/utils/storage';

export type Session = {
  token?: string;
  user?: { id: string; phone: string; username: string };
};

export function readSession(): Session {
  return (getSession() ?? {}) as Session;
}

export function readOrgId(): string | undefined {
  return getOrgId();
}

let isRedirecting = false;

export async function apiClient<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const session = readSession();
  const token = session.token;
  const orgId = options.organizationId ?? readOrgId();

  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers: {
      ...(isFormData ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(orgId ? { 'x-organization-id': orgId } : {}),
      ...options.headers,
    },
    body: isFormData
      ? (options.body as FormData)
      : options.body
        ? JSON.stringify(options.body)
        : undefined,
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  if (response.status === 401) {
    clearSession();
    if (!isRedirecting) {
      isRedirecting = true;
      setTimeout(() => {
        isRedirecting = false;
        window.location.href = '/login';
      }, 100);
    }
    throw new Error('登录已过期，请重新登录');
  }

  if (!response.ok) {
    throw new Error(body.error || `请求失败 (${response.status})`);
  }

  return body.data as T;
}
