import type { ComponentType } from 'react';
import {
  HomeOutlined,
  HomeFilled,
  FileTextOutlined,
  ApartmentOutlined,
  AccountBookOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';

export interface MenuItemConfig {
  key: string;
  label: string;
  path: string;
  icon: ComponentType;
  requireOrg?: boolean;
  children?: MenuItemConfig[];
}

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
        key: 'meter-readings',
        label: '水电抄表',
        path: '/meter-readings',
        icon: ThunderboltOutlined,
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
    ],
  },
];
