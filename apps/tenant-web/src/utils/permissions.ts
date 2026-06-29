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
  [PERMISSIONS.MEMBER_MANAGE]: '成员管理',
};

export function hasPermission(
  permissions: string[] | undefined,
  permission: string
): boolean {
  if (!permissions) return false;
  return permissions.includes('*') || permissions.includes(permission);
}
