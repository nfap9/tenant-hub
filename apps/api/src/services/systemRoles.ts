import type { SystemRole } from '@prisma/client';

export const SYSTEM_PERMISSIONS = {
  SYSTEM_AI_MODEL_MANAGE: 'system:ai_model:manage',
  SYSTEM_ORG_VIEW: 'system:org:view',
  SYSTEM_ORG_MANAGE: 'system:org:manage',
  SYSTEM_ORG_ROLE_MANAGE: 'system:org_role:manage',
  SYSTEM_USER_MANAGE: 'system:user:manage',
} as const;

export type SystemPermission =
  (typeof SYSTEM_PERMISSIONS)[keyof typeof SYSTEM_PERMISSIONS];

/** 系统角色 -> 系统权限映射 */
export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRole, string[]> = {
  SYSTEM_ADMIN: ['system:*'],
  OPERATOR: [
    SYSTEM_PERMISSIONS.SYSTEM_AI_MODEL_MANAGE,
    SYSTEM_PERMISSIONS.SYSTEM_ORG_VIEW,
    SYSTEM_PERMISSIONS.SYSTEM_ORG_MANAGE,
    SYSTEM_PERMISSIONS.SYSTEM_ORG_ROLE_MANAGE,
  ],
};

/** 获取系统角色对应的权限列表 */
export const getSystemPermissions = (
  systemRole: SystemRole | null | undefined
): string[] => {
  if (!systemRole) return [];
  return SYSTEM_ROLE_PERMISSIONS[systemRole] ?? [];
};

/** 判断是否拥有指定系统权限 */
export const hasSystemPermission = (
  systemRole: SystemRole | null | undefined,
  permission: string
): boolean => {
  const perms = getSystemPermissions(systemRole);
  return perms.includes('system:*') || perms.includes(permission);
};

/** 判断是否为系统管理员（拥有全部系统权限） */
export const isSystemAdmin = (
  systemRole: SystemRole | null | undefined
): boolean => {
  return systemRole === 'SYSTEM_ADMIN';
};
