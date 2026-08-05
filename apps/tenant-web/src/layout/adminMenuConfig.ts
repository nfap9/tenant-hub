import type { ComponentType } from 'react';
import {
  DashboardOutlined,
  ApiOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';

export interface AdminMenuItemConfig {
  key: string;
  label: string;
  path: string;
  icon: ComponentType;
  /** 仅 SYSTEM_ADMIN 可见 */
  adminOnly?: boolean;
}

/** 系统管理菜单 */
export const adminMenuConfig: AdminMenuItemConfig[] = [
  {
    key: 'admin-dashboard',
    label: '概览',
    path: '/admin',
    icon: DashboardOutlined,
  },
  {
    key: 'admin-ai-models',
    label: 'AI 模型管理',
    path: '/admin/ai-models',
    icon: ApiOutlined,
  },
  {
    key: 'admin-preset-roles',
    label: '预设角色',
    path: '/admin/preset-roles',
    icon: SafetyCertificateOutlined,
  },
  {
    key: 'admin-organizations',
    label: '组织管理',
    path: '/admin/organizations',
    icon: TeamOutlined,
  },
  {
    key: 'admin-users',
    label: '用户管理',
    path: '/admin/users',
    icon: UserOutlined,
    adminOnly: true,
  },
];
