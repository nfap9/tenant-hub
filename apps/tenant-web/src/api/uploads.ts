import { apiClient } from './client';

export async function uploadFile(
  organizationId: string,
  file: File
): Promise<{ url: string; originalName: string; size: number }> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await apiClient<{
    url: string;
    originalName: string;
    size: number;
  }>('/uploads', {
    method: 'POST',
    body: formData,
    organizationId,
  });
  return res;
}
