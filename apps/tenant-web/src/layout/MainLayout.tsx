import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Dropdown, Spin, message, Modal, Avatar } from 'antd';
import {
  HomeTwoTone,
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
  DollarOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { useMemo } from 'react';
import styles from './MainLayout.module.scss';

const { Header, Sider, Content } = Layout;

function getMenuKeyFromPath(pathname: string): string {
  if (pathname === '/') return 'dashboard';
  if (pathname.startsWith('/apartments')) return 'apartments';
  if (pathname.startsWith('/rooms')) return 'rooms';
  if (pathname.startsWith('/leases')) return 'leases';
  if (pathname.startsWith('/maintenance')) return 'maintenance';
  if (pathname.startsWith('/deposits')) return 'deposits';
  if (pathname.startsWith('/bills')) return 'bills';
  if (pathname.startsWith('/settings')) return 'settings';
  if (pathname.startsWith('/co-residents')) return 'co-residents';
  if (pathname.startsWith('/cashier-journals')) return 'cashier-journals';
  if (pathname.startsWith('/invoices')) return 'invoices';
  if (pathname.startsWith('/reports')) return 'reports';
  if (pathname.startsWith('/audit-logs')) return 'audit-logs';
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
          { key: 'leases', icon: <FileTextOutlined />, label: '租约' },
          { key: 'maintenance', icon: <ToolOutlined />, label: '维修' },
          { key: 'deposits', icon: <FileTextOutlined />, label: '押金' },
          { key: 'apartments', icon: <ApartmentOutlined />, label: '公寓' },
          { key: 'co-residents', icon: <TeamOutlined />, label: '同住人' },
          { key: 'cashier-journals', icon: <DollarOutlined />, label: '出纳' },
          { key: 'invoices', icon: <MailOutlined />, label: '发票' },
          { key: 'reports', icon: <DashboardOutlined />, label: '报表' },
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
      case 'leases':
        navigate('/leases');
        break;
      case 'deposits':
        navigate('/deposits');
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
    <Layout className={styles.mainLayout}>
      <Sider width={240} theme="light" className={styles.mainSider}>
        {/* Logo */}
        <div className={styles.siderLogo}>
          <div className={styles.logoIcon}>
            <HomeTwoTone />
          </div>
          <div>
            <div className={styles.logoTitle}>{platformInfo.name}</div>
            <div className={styles.logoSubtitle}>公寓管理工作台</div>
          </div>
        </div>

        {/* Navigation */}
        <div className={styles.siderMenuWrap}>
          <div className={styles.menuLabel}>主菜单</div>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            className={styles.mainMenu}
            items={menuItems}
            onClick={({ key }) => handleMenuClick(key)}
          />
        </div>

        {/* Bottom section */}
        <div className={styles.siderFooter}>
          <div className={styles.userPhone}>{session?.user?.phone}</div>
        </div>
      </Sider>

      <Layout className={styles.mainContentLayout}>
        <Header className={styles.mainHeader}>
          {/* Breadcrumb placeholder / page title could go here */}
          <div className={styles.headerPageTitle}>
            {getMenuLabel(menuItems, selectedKey)}
          </div>

          <div className={styles.headerRight}>
            {/* Notifications */}
            <BellOutlined
              className={styles.headerIconBtn}
              onClick={() => message.warning('暂无通知')}
            />

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
                <span className={styles.orgSwitcher}>
                  <SwapOutlined className={styles.switcherIcon} />
                  {currentMembership?.organization.name || '选择组织'}
                  <DownOutlined className={styles.switcherCaret} />
                </span>
              </Dropdown>
            ) : (
              <span className={styles.orgNameStatic}>
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
              <span className={styles.userTrigger}>
                <Avatar size={34} className={styles.userAvatar}>
                  {(
                    session?.user?.username?.[0] ||
                    session?.user?.phone?.slice(-1) ||
                    '?'
                  ).toUpperCase()}
                </Avatar>
                <span className={styles.userName}>
                  {session?.user?.username || session?.user?.phone}
                </span>
                <DownOutlined className={styles.userCaret} />
              </span>
            </Dropdown>
          </div>
        </Header>

        <Content className={styles.mainContent}>
          {loading ? (
            <div className={styles.contentLoading}>
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
