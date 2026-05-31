const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown> | FormData;
  headers?: Record<string, string>;
  organizationId?: string;
};

import {
  getSession,
  getOrgId,
  clearSession,
  setSession,
} from '@/utils/storage';

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
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function tryRefreshToken(): Promise<string | null> {
  const session = readSession();
  if (!session.token) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.token}`,
      },
    });
    if (!res.ok) return null;
    const body = await res.json();
    const newToken = body.data?.token;
    if (newToken && session.user) {
      setSession({ ...session, token: newToken, user: session.user });
    }
    return newToken || null;
  } catch {
    return null;
  }
}

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

  if (
    response.status === 401 &&
    token &&
    path !== '/auth/refresh' &&
    path !== '/auth/login/password' &&
    path !== '/auth/login/otp'
  ) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = tryRefreshToken();
    }
    const newToken = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;
    if (newToken) {
      const retryRes = await fetch(`${API_BASE}${path}`, {
        method: options.method || 'GET',
        headers: {
          ...(isFormData ? {} : { 'content-type': 'application/json' }),
          authorization: `Bearer ${newToken}`,
          ...(orgId ? { 'x-organization-id': orgId } : {}),
          ...options.headers,
        },
        body: isFormData
          ? (options.body as FormData)
          : options.body
            ? JSON.stringify(options.body)
            : undefined,
      });
      const retryText = await retryRes.text();
      const retryBody = retryText ? JSON.parse(retryText) : {};
      if (!retryRes.ok) {
        throw new Error(retryBody.error || `请求失败 (${retryRes.status})`);
      }
      return retryBody.data as T;
    }
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
