import Taro from '@tarojs/taro';
import { getApiBaseUrl } from '../constants/config';
import { getSession } from '../utils/storage';

export type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  organizationId?: string;
};

export async function apiClient<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const session = getSession();
  const token = session?.token;
  const url = `${getApiBaseUrl()}${path}`;
  const res = await Taro.request({
    url,
    method: options.method || 'GET',
    data: options.body,
    header: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.organizationId ? { 'x-organization-id': options.organizationId } : {}),
      ...options.headers,
    },
  });
  if (!res.statusCode || res.statusCode >= 400) {
    const errorData = typeof res.data === 'string' ? { error: res.data } : (res.data as { error?: string }) || {};
    throw new Error(errorData.error || `请求失败 (${res.statusCode})`);
  }
  return (res.data as { data: T }).data;
}
