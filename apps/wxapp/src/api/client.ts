import Taro from '@tarojs/taro';
import { API_BASE_URL } from '../constants/config';

export type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
};

export async function apiClient<T>(
  path: string,
  token?: string,
  options: ApiOptions = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const res = await Taro.request({
    url,
    method: options.method || 'GET',
    data: options.body,
    header: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const data = res.data as { data?: T; error?: string };

  if (res.statusCode >= 400 || data.error) {
    throw new Error(data.error || `HTTP ${res.statusCode}`);
  }

  return data.data as T;
}
