import axios from 'axios';
import { message } from 'antd';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const orgId = localStorage.getItem('orgId');
  if (orgId) {
    config.headers['x-organization-id'] = orgId;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('orgId');
        window.location.href = '/login';
        return Promise.reject(error);
      }
      const msg = data?.message || data?.error || '请求失败';
      message.error(msg);
    } else if (error.request) {
      message.error('网络错误，请检查连接');
    }
    return Promise.reject(error);
  }
);

export default api;
