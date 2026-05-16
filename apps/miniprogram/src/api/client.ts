import Taro from '@tarojs/taro';
import { getApiBaseUrl } from '../constants/config';
import { getSession, clearSession } from '../utils/storage';

export type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  organizationId?: string;
};

let isRedirecting = false;

const isLoginPageActive = () => {
  try {
    const pages = Taro.getCurrentPages?.() ?? [];
    const current = pages[pages.length - 1];
    return current?.route === 'pages/login/index';
  } catch {
    return false;
  }
};

export async function apiClient<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const session = getSession();
  const token = session?.token;
  const url = `${getApiBaseUrl()}${path}`;

  const res = await Taro.request({
    url,
    method: options.method || 'GET',
    data: options.body,
    timeout: 10000,
    header: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.organizationId ? { 'x-organization-id': options.organizationId } : {}),
      ...options.headers,
    },
  });

  // 401 未授权：自动清除 session 并跳转到登录页
  if (res.statusCode === 401) {
    clearSession();
    if (!isRedirecting && !isLoginPageActive()) {
      isRedirecting = true;
      // 延迟一点，避免连续多个 401 请求导致多次跳转
      setTimeout(() => {
        Taro.reLaunch({ url: '/pages/login/index' }).finally(() => {
          isRedirecting = false;
        });
      }, 100);
    }
    throw new Error('登录已过期，请重新登录');
  }

  if (!res.statusCode || res.statusCode >= 400) {
    const errorData = typeof res.data === 'string' ? { error: res.data } : (res.data as { error?: string }) || {};
    throw new Error(errorData.error || `请求失败 (${res.statusCode})`);
  }

  return (res.data as { data: T }).data;
}
