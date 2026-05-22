import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Layout,
  Menu,
  Dropdown,
  Spin,
  message,
  Modal,
  Badge,
  Avatar,
} from 'antd';
import {
  HomeOutlined,
  ApartmentOutlined,
  HomeFilled,
  FileTextOutlined,
  SettingOutlined,
  SwapOutlined,
  LogoutOutlined,
  UserOutlined,
  DownOutlined,
  DashboardOutlined,
  BellOutlined,
  TeamOutlined,
  AppstoreOutlined,
  SafetyCertificateOutlined,
  MailOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { useMemo } from 'react';
import './MainLayout.scss';

const { Header, Sider, Content } = Layout;

function getMenuKeyFromPath(pathname: string): string {
  if (pathname === '/') return 'dashboard';
  if (pathname.startsWith('/apartments')) return 'apartments';
  if (pathname.startsWith('/rooms')) return 'rooms';
  if (pathname.startsWith('/bills')) return 'bills';
  if (pathname.startsWith('/settings')) return 'settings';
  if (pathname === '/ops') return 'ops-dashboard';
  if (pathname.startsWith('/ops/users')) return 'ops-users';
  if (pathname.startsWith('/ops/plans')) return 'ops-plans';
  if (pathname.startsWith('/ops/organizations')) return 'ops-organizations';
  if (pathname.startsWith('/ops/roles')) return 'ops-roles';
  if (pathname.startsWith('/ops/sms')) return 'ops-sms';
  if (pathname.startsWith('/ops/settings')) return 'ops-settings';
  if (pathname.startsWith('/ops')) return 'ops-dashboard';
  return 'dashboard';
}

function getMenuLabel(
  items: Array<{
    key: string;
    label: string;
    children?: Array<{ key: string; label: string }>;
  }>,
  key: string
): string {
  for (const item of items) {
    if (item.key === key) return item.label;
    if (item.children) {
      const child = item.children.find((c) => c.key === key);
      if (child) return child.label;
    }
  }
  return '';
}

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    session,
    memberships,
    currentMembership,
    currentOrgId,
    setCurrentOrgId,
    signOut,
    platformInfo,
    loading,
    platformRole,
  } = useAppSession();

  const selectedKey = useMemo(
    () => getMenuKeyFromPath(location.pathname),
    [location.pathname]
  );
  const noOrg = memberships.length === 0;

  const menuItems = [
    ...(noOrg
      ? []
      : [
          { key: 'dashboard', icon: <HomeOutlined />, label: '首页' },
          { key: 'rooms', icon: <HomeFilled />, label: '房间' },
          { key: 'bills', icon: <FileTextOutlined />, label: '账单' },
          { key: 'apartments', icon: <ApartmentOutlined />, label: '公寓' },
        ]),
    { key: 'settings', icon: <SettingOutlined />, label: '更多' },
    ...(platformRole === 'SUPER_ADMIN'
      ? [
          {
            key: 'ops',
            icon: <DashboardOutlined />,
            label: '运营配置',
            children: [
              {
                key: 'ops-dashboard',
                icon: <DashboardOutlined />,
                label: '运营总览',
              },
              { key: 'ops-users', icon: <TeamOutlined />, label: '租户管理' },
              {
                key: 'ops-plans',
                icon: <AppstoreOutlined />,
                label: '套餐配置',
              },
              {
                key: 'ops-organizations',
                icon: <ApartmentOutlined />,
                label: '组织管理',
              },
              {
                key: 'ops-roles',
                icon: <SafetyCertificateOutlined />,
                label: '角色权限',
              },
              { key: 'ops-sms', icon: <MailOutlined />, label: '短信配置' },
              {
                key: 'ops-settings',
                icon: <ToolOutlined />,
                label: '系统配置',
              },
            ],
          },
        ]
      : []),
  ];

  const handleMenuClick = (key: string) => {
    switch (key) {
      case 'dashboard':
        navigate('/');
        break;
      case 'rooms':
        navigate('/rooms');
        break;
      case 'bills':
        navigate('/bills');
        break;
      case 'apartments':
        navigate('/apartments');
        break;
      case 'settings':
        navigate('/settings');
        break;
      case 'ops-dashboard':
        navigate('/ops');
        break;
      case 'ops-users':
        navigate('/ops/users');
        break;
      case 'ops-plans':
        navigate('/ops/plans');
        break;
      case 'ops-organizations':
        navigate('/ops/organizations');
        break;
      case 'ops-roles':
        navigate('/ops/roles');
        break;
      case 'ops-sms':
        navigate('/ops/sms');
        break;
      case 'ops-settings':
        navigate('/ops/settings');
        break;
    }
  };

  const orgOptions = useMemo(
    () =>
      memberships.map((m) => ({
        key: m.organization.id,
        label: m.organization.name,
      })),
    [memberships]
  );

  const handleSignOut = () => {
    Modal.confirm({
      title: '确认退出登录？',
      okText: '退出',
      cancelText: '取消',
      onOk: () => {
        signOut();
        message.success('已退出登录');
      },
    });
  };

  return (
    <Layout className="main-layout">
      <Sider width={240} theme="light" className="main-sider">
        {/* Logo */}
        <div className="sider-logo">
          <div className="logo-icon">
            <HomeOutlined />
          </div>
          <div>
            <div className="logo-title">{platformInfo.name}</div>
            <div className="logo-subtitle">公寓管理工作台</div>
          </div>
        </div>

        {/* Navigation */}
        <div className="sider-menu-wrap">
          <div className="menu-label">主菜单</div>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            className="main-menu"
            items={menuItems}
            onClick={({ key }) => handleMenuClick(key)}
          />
        </div>

        {/* Bottom section */}
        <div className="sider-footer">
          <div className="user-phone">{session?.user?.phone}</div>
        </div>
      </Sider>

      <Layout className="main-content-layout">
        <Header className="main-header">
          {/* Breadcrumb placeholder / page title could go here */}
          <div className="header-page-title">
            {getMenuLabel(menuItems, selectedKey)}
          </div>

          <div className="header-right">
            {/* Notifications */}
            <Badge dot>
              <BellOutlined className="header-icon-btn" />
            </Badge>

            {/* Org Switcher */}
            {memberships.length > 1 ? (
              <Dropdown
                menu={{
                  items: orgOptions,
                  selectable: true,
                  selectedKeys: currentOrgId ? [currentOrgId] : [],
                  onClick: (e) => setCurrentOrgId(e.key),
                }}
              >
                <span className="org-switcher org-switcher-hover">
                  <SwapOutlined className="switcher-icon" />
                  {currentMembership?.organization.name || '选择组织'}
                  <DownOutlined className="switcher-caret" />
                </span>
              </Dropdown>
            ) : (
              <span className="org-name-static">
                {currentMembership?.organization.name ||
                  (noOrg ? '未加入组织' : '')}
              </span>
            )}

            {/* User */}
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'account',
                    icon: <UserOutlined />,
                    label: '账号设置',
                    onClick: () => navigate('/settings/account'),
                  },
                  {
                    key: 'logout',
                    icon: <LogoutOutlined />,
                    label: '退出登录',
                    onClick: handleSignOut,
                  },
                ],
              }}
            >
              <span className="user-trigger">
                <Avatar size={34} className="user-avatar">
                  {(
                    session?.user?.username?.[0] ||
                    session?.user?.phone?.slice(-1) ||
                    '?'
                  ).toUpperCase()}
                </Avatar>
                <span className="user-name">
                  {session?.user?.username || session?.user?.phone}
                </span>
                <DownOutlined className="user-caret" />
              </span>
            </Dropdown>
          </div>
        </Header>

        <Content className="main-content">
          {loading ? (
            <div className="content-loading">
              <Spin size="large" />
            </div>
          ) : (
            <div className="page-content">
              <Outlet />
            </div>
          )}
        </Content>
      </Layout>
    </Layout>
  );
}
