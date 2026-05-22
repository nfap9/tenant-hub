const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  organizationId?: string;
};

export type Session = {
  token?: string;
  user?: { id: string; phone: string; username: string };
};

const SESSION_KEY = 'tenantHubSession';
const ORG_KEY = 'tenantHubCurrentOrgId';

export function readSession(): Session {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || '{}') as Session;
  } catch {
    return {};
  }
}

export function writeSession(patch: Partial<Session>) {
  const next = { ...readSession(), ...patch };
  localStorage.setItem(SESSION_KEY, JSON.stringify(next));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(ORG_KEY);
}

export function readOrgId(): string | undefined {
  return localStorage.getItem(ORG_KEY) || undefined;
}

export function writeOrgId(id: string) {
  localStorage.setItem(ORG_KEY, id);
}

let isRedirecting = false;

export async function apiClient<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const session = readSession();
  const token = session.token;
  const orgId = options.organizationId ?? readOrgId();

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(orgId ? { 'x-organization-id': orgId } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
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
