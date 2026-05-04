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
