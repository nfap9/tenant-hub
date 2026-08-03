import Constants from 'expo-constants';
import { useSessionStore } from '@/store/sessionStore';

/**
 * 后端统一响应：成功 `{ data: ... }`，错误 `{ error: "..." }`。
 * API 地址在 app.json 的 expo.extra.apiBaseUrl 配置（真机/Android 模拟器需改为局域网 IP 或 10.0.2.2）。
 */
export const API_BASE =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  'http://localhost:4000/api';

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  /** 默认取 sessionStore 的 currentOrgId，可用此参数覆盖 */
  organizationId?: string;
};

export async function apiClient<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { token, currentOrgId } = useSessionStore.getState();
  const orgId = options.organizationId ?? currentOrgId;

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
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
    // 登录过期：清空会话，根布局守卫会自动跳回登录页
    useSessionStore.getState().handleUnauthorized();
    throw new HttpError(401, body.error ?? '登录已过期，请重新登录');
  }

  if (!response.ok) {
    throw new HttpError(
      response.status,
      body.error ?? `请求失败 (${response.status})`
    );
  }

  return body.data as T;
}
