import { apiClient } from './client';
import type { PlatformInfo } from '@/context/AppSessionContext';

export async function getPlatformInfo() {
  return apiClient<PlatformInfo>('/platform/info');
}
