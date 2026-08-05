import { apiClient } from './client';
import type { SystemRole } from '@/types/domain';

export type AdminOrganization = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: 'ACTIVE' | 'SUSPENDED';
  ownerId: string;
  aiModelDefault: string | null;
  createdAt: string;
  _count: { members: number; apartments: number };
};

export type AdminUser = {
  id: string;
  phone: string;
  username: string;
  systemRole: SystemRole;
  createdAt: string;
};

export type PresetRole = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  system: boolean;
  permissions: string[];
};

export async function listAllOrganizations(): Promise<AdminOrganization[]> {
  return apiClient<AdminOrganization[]>('/admin/organizations');
}

export async function listAllUsers(): Promise<AdminUser[]> {
  return apiClient<AdminUser[]>('/admin/users');
}

export async function updateUserSystemRole(
  userId: string,
  systemRole: SystemRole
): Promise<AdminUser> {
  return apiClient<AdminUser>(`/admin/users/${userId}/system-role`, {
    method: 'POST',
    body: { systemRole } as Record<string, unknown>,
  });
}

export async function listPresetRoles(): Promise<PresetRole[]> {
  return apiClient<PresetRole[]>('/admin/preset-roles');
}

export async function updatePresetRole(
  roleId: string,
  data: { name: string; description?: string; permissions: string[] }
): Promise<PresetRole> {
  return apiClient<PresetRole>(`/admin/preset-roles/${roleId}/update`, {
    method: 'POST',
    body: data as Record<string, unknown>,
  });
}
