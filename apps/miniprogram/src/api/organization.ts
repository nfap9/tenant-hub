import { apiClient } from './client';
import type {
  Membership,
  OrgMember,
  OrgRole,
  Plan,
  SubscriptionOverview,
} from '../types/domain';

export async function getOrganizations(): Promise<
  Membership['organization'][]
> {
  return apiClient('/organizations');
}

export async function createOrganization(payload: {
  name: string;
  description?: string;
}): Promise<Membership['organization']> {
  return apiClient('/organizations', {
    method: 'POST',
    body: payload,
  });
}

export async function updateOrganization(
  organizationId: string,
  payload: {
    name: string;
    description?: string;
  }
) {
  return apiClient(`/organizations/${organizationId}`, {
    method: 'PUT',
    body: payload,
    organizationId,
  });
}

export async function deleteOrganization(
  organizationId: string,
  confirmName: string
) {
  return apiClient(`/organizations/${organizationId}`, {
    method: 'DELETE',
    body: { confirmName },
    organizationId,
  });
}

export async function joinOrganization(payload: { inviteCode: string }) {
  return apiClient<Membership>('/organizations/join', {
    method: 'POST',
    body: payload,
  });
}

export async function refreshInviteCode(organizationId: string) {
  return apiClient<{ inviteCode: string }>(
    `/organizations/${organizationId}/refresh-invite-code`,
    {
      method: 'POST',
      organizationId,
    }
  );
}

export async function getOrganizationMembers(
  organizationId: string
): Promise<OrgMember[]> {
  return apiClient(`/organizations/${organizationId}/members`, {
    organizationId,
  });
}

export async function getOrganizationRoles(
  organizationId: string
): Promise<OrgRole[]> {
  return apiClient(`/organizations/${organizationId}/roles`, {
    organizationId,
  });
}

export async function updateMemberRole(
  organizationId: string,
  memberId: string,
  roleId: string
) {
  return apiClient(
    `/organizations/${organizationId}/members/${memberId}/role`,
    {
      method: 'PUT',
      body: { roleId },
      organizationId,
    }
  );
}

export async function removeMember(organizationId: string, memberId: string) {
  return apiClient(`/organizations/${organizationId}/members/${memberId}`, {
    method: 'DELETE',
    organizationId,
  });
}

export async function transferOwnership(
  organizationId: string,
  userId: string
) {
  return apiClient(`/organizations/${organizationId}/transfer-owner`, {
    method: 'POST',
    body: { userId },
    organizationId,
  });
}

export async function getPlans(): Promise<Plan[]> {
  return apiClient('/organizations/plans');
}

export async function getSubscription(
  organizationId: string
): Promise<SubscriptionOverview> {
  return apiClient(`/organizations/${organizationId}/subscription`, {
    organizationId,
  });
}

export async function subscribePlan(organizationId: string, planId: string) {
  return apiClient(`/organizations/${organizationId}/subscriptions`, {
    method: 'POST',
    body: { planId },
    organizationId,
  });
}
