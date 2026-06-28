import type { ComponentType } from 'react';
import {
  HomeOutlined,
  HomeFilled,
  FileTextOutlined,
  ApartmentOutlined,
  SettingOutlined,
  DashboardOutlined,
  AccountBookOutlined,
  TeamOutlined,
  AppstoreOutlined,
  SafetyCertificateOutlined,
  MailOutlined,
  ToolOutlined,
  PlusOutlined,
  UserOutlined,
  CrownOutlined,
} from '@ant-design/icons';

export interface MenuItemConfig {
  key: string;
  label: string;
  path: string;
  icon: ComponentType;
  requireOrg?: boolean;
  children?: MenuItemConfig[];
}

/** 智能助手 — 新对话 */
export const agentNewConfig: MenuItemConfig = {
  key: 'agent-new',
  label: '新对话',
  path: '/agent',
  icon: PlusOutlined,
  requireOrg: true,
};

/** 业务菜单 */
export const bizMenuConfig: MenuItemConfig[] = [
  {
    key: 'dashboard',
    label: '首页',
    path: '/',
    icon: HomeOutlined,
    requireOrg: true,
  },
  {
    key: 'asset-management',
    label: '资产管理',
    path: '/apartments',
    icon: ApartmentOutlined,
    requireOrg: true,
    children: [
      {
        key: 'apartments',
        label: '公寓',
        path: '/apartments',
        icon: ApartmentOutlined,
        requireOrg: true,
      },
      {
        key: 'rooms',
        label: '房间',
        path: '/rooms',
        icon: HomeFilled,
        requireOrg: true,
      },
    ],
  },
  {
    key: 'lease-management',
    label: '租务管理',
    path: '/leases',
    icon: FileTextOutlined,
    requireOrg: true,
    children: [
      {
        key: 'leases',
        label: '租约',
        path: '/leases',
        icon: FileTextOutlined,
        requireOrg: true,
      },
      {
        key: 'deposits',
        label: '押金',
        path: '/deposits',
        icon: FileTextOutlined,
        requireOrg: true,
      },
    ],
  },
  {
    key: 'finance-management',
    label: '财务管理',
    path: '/bills',
    icon: AccountBookOutlined,
    requireOrg: true,
    children: [
      {
        key: 'bills',
        label: '账单',
        path: '/bills',
        icon: FileTextOutlined,
        requireOrg: true,
      },
      {
        key: 'transactions',
        label: '收支记录',
        path: '/transactions',
        icon: AccountBookOutlined,
        requireOrg: true,
      },
    ],
  },
  {
    key: 'system-settings',
    label: '系统设置',
    path: '/settings',
    icon: SettingOutlined,
    children: [
      {
        key: 'settings',
        label: '设置首页',
        path: '/settings',
        icon: SettingOutlined,
      },
      {
        key: 'settings-account',
        label: '账号设置',
        path: '/settings/account',
        icon: UserOutlined,
      },
      {
        key: 'settings-organization',
        label: '组织管理',
        path: '/settings/organization',
        icon: TeamOutlined,
      },
      {
        key: 'settings-plan',
        label: '套餐订阅',
        path: '/settings/plan',
        icon: CrownOutlined,
        requireOrg: true,
      },
    ],
  },
];

/** 运营配置（仅 SUPER_ADMIN） */
export const opsMenuConfig: MenuItemConfig[] = [
  {
    key: 'ops-dashboard',
    label: '运营总览',
    path: '/ops',
    icon: DashboardOutlined,
  },
  {
    key: 'ops-users',
    label: '租户管理',
    path: '/ops/users',
    icon: TeamOutlined,
  },
  {
    key: 'ops-plans',
    label: '套餐配置',
    path: '/ops/plans',
    icon: AppstoreOutlined,
  },
  {
    key: 'ops-organizations',
    label: '组织管理',
    path: '/ops/organizations',
    icon: ApartmentOutlined,
  },
  {
    key: 'ops-roles',
    label: '角色权限',
    path: '/ops/roles',
    icon: SafetyCertificateOutlined,
  },
  {
    key: 'ops-sms',
    label: '短信配置',
    path: '/ops/sms',
    icon: MailOutlined,
  },
  {
    key: 'ops-settings',
    label: '系统配置',
    path: '/ops/settings',
    icon: ToolOutlined,
  },
];
