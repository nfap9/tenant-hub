import { apiClient } from "./client";
import type { OrgInvite, OrgMember, OrgRole } from "@/types/domain";

export type CreateOrganizationInput = {
  name: string;
  description?: string;
};

export type JoinOrganizationInput = {
  inviteCode: string;
};

export type CreateInviteInput = {
  expiresInHours?: number;
};

export type SubscriptionOverview = {
  quotaLimitEnabled?: boolean;
};

export async function createOrganization(input: CreateOrganizationInput) {
  return apiClient<{ id: string; name: string; code: string }>("/organizations", {
    method: "POST",
    body: input as Record<string, unknown>,
  });
}

export async function joinOrganization(input: JoinOrganizationInput) {
  return apiClient<{ organization: { id: string; name: string }; member: { id: string } }>("/organizations/join", {
    method: "POST",
    body: input as Record<string, unknown>,
  });
}

export async function getOrganizationInvites(organizationId: string) {
  return apiClient<OrgInvite[]>(`/organizations/${organizationId}/invites`, { organizationId });
}

export async function createOrganizationInvite(organizationId: string, input?: CreateInviteInput) {
  return apiClient<OrgInvite>(`/organizations/${organizationId}/invites`, {
    method: "POST",
    organizationId,
    body: (input ?? {}) as Record<string, unknown>,
  });
}

export async function getOrganizationMembers(organizationId: string) {
  return apiClient<OrgMember[]>(`/organizations/${organizationId}/members`, { organizationId });
}

export async function getOrganizationRoles(organizationId: string) {
  return apiClient<OrgRole[]>(`/organizations/${organizationId}/roles`, { organizationId });
}

export async function getOrganizationSubscription(organizationId: string) {
  return apiClient<SubscriptionOverview>(`/organizations/${organizationId}/subscription`, { organizationId });
}
