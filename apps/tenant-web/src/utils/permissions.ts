export const PERMISSIONS = {
  APARTMENT_VIEW: 'apartment:view',
  APARTMENT_MANAGE: 'apartment:manage',
  ROOM_VIEW: 'room:view',
  ROOM_MANAGE: 'room:manage',
  LEASE_VIEW: 'lease:view',
  LEASE_MANAGE: 'lease:manage',
  BILL_VIEW: 'bill:view',
  BILL_MANAGE: 'bill:manage',
  DEPOSIT_VIEW: 'deposit:view',
  DEPOSIT_MANAGE: 'deposit:manage',
  ORG_MANAGE: 'org:manage',
  ORG_ROLE_MANAGE: 'org_role:manage',
  MEMBER_MANAGE: 'member:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_LABELS: Record<string, string> = {
  [PERMISSIONS.APARTMENT_VIEW]: '查看公寓',
  [PERMISSIONS.APARTMENT_MANAGE]: '管理公寓',
  [PERMISSIONS.ROOM_VIEW]: '查看房间',
  [PERMISSIONS.ROOM_MANAGE]: '管理房间',
  [PERMISSIONS.LEASE_VIEW]: '查看租约',
  [PERMISSIONS.LEASE_MANAGE]: '管理租约',
  [PERMISSIONS.BILL_VIEW]: '查看账单',
  [PERMISSIONS.BILL_MANAGE]: '管理账单',
  [PERMISSIONS.DEPOSIT_VIEW]: '查看押金',
  [PERMISSIONS.DEPOSIT_MANAGE]: '管理押金',
  [PERMISSIONS.ORG_MANAGE]: '组织管理',
  [PERMISSIONS.ORG_ROLE_MANAGE]: '角色管理',
  [PERMISSIONS.MEMBER_MANAGE]: '成员管理',
};

export const SYSTEM_PERMISSIONS = {
  SYSTEM_AI_MODEL_MANAGE: 'system:ai_model:manage',
  SYSTEM_ORG_VIEW: 'system:org:view',
  SYSTEM_ORG_MANAGE: 'system:org:manage',
  SYSTEM_ORG_ROLE_MANAGE: 'system:org_role:manage',
  SYSTEM_USER_MANAGE: 'system:user:manage',
} as const;

export const SYSTEM_PERMISSION_LABELS: Record<string, string> = {
  [SYSTEM_PERMISSIONS.SYSTEM_AI_MODEL_MANAGE]: 'AI 模型管理',
  [SYSTEM_PERMISSIONS.SYSTEM_ORG_VIEW]: '查看所有组织',
  [SYSTEM_PERMISSIONS.SYSTEM_ORG_MANAGE]: '管理组织',
  [SYSTEM_PERMISSIONS.SYSTEM_ORG_ROLE_MANAGE]: '管理预设角色',
  [SYSTEM_PERMISSIONS.SYSTEM_USER_MANAGE]: '用户管理',
};

export function hasPermission(
  permissions: string[] | undefined,
  permission: string
): boolean {
  if (!permissions) return false;
  return permissions.includes('*') || permissions.includes(permission);
}

export function hasSystemPermission(
  systemRole: string | null | undefined,
  permission: string
): boolean {
  if (!systemRole) return false;
  if (systemRole === 'SYSTEM_ADMIN') return true;
  if (systemRole === 'OPERATOR') {
    return (
      permission === SYSTEM_PERMISSIONS.SYSTEM_AI_MODEL_MANAGE ||
      permission === SYSTEM_PERMISSIONS.SYSTEM_ORG_VIEW ||
      permission === SYSTEM_PERMISSIONS.SYSTEM_ORG_MANAGE ||
      permission === SYSTEM_PERMISSIONS.SYSTEM_ORG_ROLE_MANAGE
    );
  }
  return false;
}

export function isSystemAdmin(systemRole: string | null | undefined): boolean {
  return systemRole === 'SYSTEM_ADMIN';
}

