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
  RobotOutlined,
} from '@ant-design/icons';

export interface MenuItemConfig {
  key: string;
  label: string;
  path: string;
  icon: ComponentType;
  requireOrg?: boolean;
  children?: MenuItemConfig[];
}

export const menuConfig: MenuItemConfig[] = [
  {
    key: 'dashboard',
    label: '首页',
    path: '/',
    icon: HomeOutlined,
    requireOrg: true,
  },
  {
    key: 'agent',
    label: '智能助手',
    path: '/agent',
    icon: RobotOutlined,
    requireOrg: true,
  },
  {
    key: 'rooms',
    label: '房间',
    path: '/rooms',
    icon: HomeFilled,
    requireOrg: true,
  },
  {
    key: 'bills',
    label: '账单',
    path: '/bills',
    icon: FileTextOutlined,
    requireOrg: true,
  },
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
  {
    key: 'transactions',
    label: '收支记录',
    path: '/transactions',
    icon: AccountBookOutlined,
    requireOrg: true,
  },
  {
    key: 'apartments',
    label: '公寓',
    path: '/apartments',
    icon: ApartmentOutlined,
    requireOrg: true,
  },
  {
    key: 'settings',
    label: '更多',
    path: '/settings',
    icon: SettingOutlined,
  },
];

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
