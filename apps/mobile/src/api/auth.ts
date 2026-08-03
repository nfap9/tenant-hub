import { apiClient } from './client';

export type SessionUser = {
  id: string;
  phone: string;
  username: string;
};

/** GET /api/auth/me 返回的组织成员信息（含组织与角色） */
export type Membership = {
  id: string;
  organizationId: string;
  roleId: string;
  status: string;
  organization: {
    id: string;
    name: string;
    code: string;
    status: string;
  };
  role: {
    id: string;
    code: string;
    name: string;
    permissions: string[];
  };
};

export type LoginResult = {
  user: SessionUser;
  token: string;
};

export type MeResult = {
  user: SessionUser;
  memberships: Membership[];
};

export const login = (phone: string, password: string) =>
  apiClient<LoginResult>('/auth/login', {
    method: 'POST',
    body: { phone, password },
  });

export const fetchMe = () => apiClient<MeResult>('/auth/me');
