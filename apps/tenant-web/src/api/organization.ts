import { apiClient } from './client';
import type { OrgMember, OrgRole } from '@/types/domain';

export type CreateOrganizationInput = {
  name: string;
  description?: string;
};

export type UpdateOrganizationInput = {
  name: string;
  description?: string;
};

export type JoinOrganizationInput = {
  inviteCode: string;
};

export type CreateRoleInput = {
  name: string;
  description?: string;
  permissions: string[];
};

export async function createOrganization(input: CreateOrganizationInput) {
  return apiClient<{ id: string; name: string; code: string }>(
    '/organizations',
    {
      method: 'POST',
      body: input as Record<string, unknown>,
    }
  );
}

export async function updateOrganization(
  organizationId: string,
  input: UpdateOrganizationInput
) {
  return apiClient<{ id: string; name: string; description?: string }>(
    `/organizations/${organizationId}`,
    {
      method: 'PUT',
      body: input as Record<string, unknown>,
      organizationId,
    }
  );
}

export async function deleteOrganization(
  organizationId: string,
  confirmName: string
) {
  return apiClient<void>(`/organizations/${organizationId}`, {
    method: 'DELETE',
    body: { confirmName } as Record<string, unknown>,
    organizationId,
  });
}

export async function joinOrganization(input: JoinOrganizationInput) {
  return apiClient<{
    organization: { id: string; name: string };
    member: { id: string };
  }>('/organizations/join', {
    method: 'POST',
    body: input as Record<string, unknown>,
  });
}

export async function refreshOrganizationInviteCode(organizationId: string) {
  return apiClient<{ inviteCode: string }>(
    `/organizations/${organizationId}/refresh-invite-code`,
    {
      method: 'POST',
      organizationId,
    }
  );
}

export async function transferOrganizationOwnership(
  organizationId: string,
  userId: string
) {
  return apiClient<void>(`/organizations/${organizationId}/transfer-owner`, {
    method: 'POST',
    body: { userId } as Record<string, unknown>,
    organizationId,
  });
}

export async function getOrganizationMembers(organizationId: string) {
  return apiClient<OrgMember[]>(`/organizations/${organizationId}/members`, {
    organizationId,
  });
}

export async function disableOrganizationMember(
  organizationId: string,
  memberId: string
) {
  return apiClient<void>(
    `/organizations/${organizationId}/members/${memberId}`,
    {
      method: 'DELETE',
      organizationId,
    }
  );
}

export async function updateOrganizationMemberRole(
  organizationId: string,
  memberId: string,
  roleId: string
) {
  return apiClient<void>(
    `/organizations/${organizationId}/members/${memberId}/role`,
    {
      method: 'PUT',
      body: { roleId } as Record<string, unknown>,
      organizationId,
    }
  );
}

export async function getOrganizationRoles(organizationId: string) {
  return apiClient<OrgRole[]>(`/organizations/${organizationId}/roles`, {
    organizationId,
  });
}

export async function createOrganizationRole(
  organizationId: string,
  input: CreateRoleInput
) {
  return apiClient<OrgRole>(`/organizations/${organizationId}/roles`, {
    method: 'POST',
    body: input as Record<string, unknown>,
    organizationId,
  });
}

export async function updateOrganizationRole(
  organizationId: string,
  roleId: string,
  input: CreateRoleInput
) {
  return apiClient<OrgRole>(
    `/organizations/${organizationId}/roles/${roleId}`,
    {
      method: 'PUT',
      body: input as Record<string, unknown>,
      organizationId,
    }
  );
}

export async function deleteOrganizationRole(
  organizationId: string,
  roleId: string
) {
  return apiClient<void>(`/organizations/${organizationId}/roles/${roleId}`, {
    method: 'DELETE',
    organizationId,
  });
}
