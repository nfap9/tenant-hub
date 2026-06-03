import { apiClient } from './client';
import type { OrgMember, OrgRole } from '@/types/domain';

export type CreateOrganizationInput = {
  name: string;
  description?: string;
};

export type JoinOrganizationInput = {
  inviteCode: string;
};

export type SubscriptionOverview = {
  quotaLimitEnabled?: boolean;
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

export async function getOrganizationMembers(organizationId: string) {
  return apiClient<OrgMember[]>(`/organizations/${organizationId}/members`, {
    organizationId,
  });
}

export async function getOrganizationRoles(organizationId: string) {
  return apiClient<OrgRole[]>(`/organizations/${organizationId}/roles`, {
    organizationId,
  });
}

export async function getOrganizationSubscription(organizationId: string) {
  return apiClient<SubscriptionOverview>(
    `/organizations/${organizationId}/subscription`,
    { organizationId }
  );
}
