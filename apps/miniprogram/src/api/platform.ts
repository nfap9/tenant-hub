import { apiClient } from './client';
import type { PlatformInfo } from '../context/AppSessionContext';

export async function getPlatformInfo(): Promise<PlatformInfo> {
  return apiClient('/platform/info');
}
