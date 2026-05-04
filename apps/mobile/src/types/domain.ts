export type Membership = {
  organization: { id: string; name: string; code: string; description?: string; ownerId: string };
  role: { id: string; code: string; name: string; permissions: string[] };
};

export type OrgRole = { id: string; code: string; name: string; permissions: string[] };

export type OrgMember = {
  id: string;
  userId: string;
  roleId: string;
  user: { id: string; phone: string; username: string };
  role: OrgRole;
};

export type Plan = {
  id: string;
  name: string;
  apartmentLimit: number;
  roomLimit: number;
  memberLimit: number;
  price: string | number;
  enabled: boolean;
};

export type Subscription = {
  id: string;
  organizationId: string;
  planId: string;
  startsAt: string;
  endsAt?: string;
  active: boolean;
  plan: Plan;
};

export type SubscriptionOverview = {
  subscription?: Subscription;
  usage: { apartments: number; members: number };
  extraQuota: { apartmentQuota: number; roomQuota: number; memberQuota: number };
};
