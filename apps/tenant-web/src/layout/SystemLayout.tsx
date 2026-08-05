import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Dropdown, Avatar, Spin, message, Modal, type MenuProps } from 'antd';
import {
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  DownOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { useMemo, useState, useEffect } from 'react';
import { adminMenuConfig } from './adminMenuConfig';
import styles from './SystemLayout.module.scss';

const { Header, Sider, Content } = Layout;

/** 菜单 key -> label 映射，用于 header 标题 */
function getLabelFromKey(key: string): string {
  const item = adminMenuConfig.find((i) => i.key === key);
  return item?.label ?? '';
}

/** 路径 -> 菜单 key */
function getKeyFromPath(pathname: string): string {
  // 优先精确匹配
  const exact = adminMenuConfig.find((i) => i.path === pathname);
  if (exact) return exact.key;

  // 前缀匹配（最长优先）
  const prefix = adminMenuConfig
    .filter((i) => pathname.startsWith(i.path + '/'))
    .sort((a, b) => b.path.length - a.path.length);
  if (prefix.length > 0) return prefix[0].key;

  return 'admin-dashboard';
}

export default function SystemLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, systemRole, memberships, signOut, loading } =
    useAppSession();

  const selectedKey = useMemo(
    () => getKeyFromPath(location.pathname),
    [location.pathname]
  );

  const [openKeys, setOpenKeys] = useState<string[]>([]);

  useEffect(() => {
    setOpenKeys((prev) => Array.from(new Set([...prev])));
  }, [selectedKey]);

  const isAdmin = systemRole === 'SYSTEM_ADMIN';

  const menuItems = useMemo<MenuProps['items']>(() => {
    return adminMenuConfig
      .filter((item) => !item.adminOnly || isAdmin)
      .map((item) => ({
        key: item.key,
        icon: <item.icon />,
        label: item.label,
      }));
  }, [isAdmin]);

  const handleMenuClick = (key: string) => {
    const item = adminMenuConfig.find((i) => i.key === key);
    if (item) navigate(item.path);
  };

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

  const userMenuItems = useMemo<MenuProps['items']>(
    () => [
      {
        key: 'account',
        icon: <UserOutlined />,
        label: '个人中心',
        onClick: () => navigate('/account'),
      },
      ...(memberships.length > 0
        ? [
            {
              key: 'workspace',
              icon: <SwapOutlined />,
              label: '切换到业务工作台',
              onClick: () => navigate('/'),
            },
          ]
        : []),
      { type: 'divider' as const },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: handleSignOut,
      },
    ],
    [navigate, memberships.length, signOut]
  );

  return (
    <Layout className={styles.systemLayout}>
      <Sider width={240} theme="light" className={styles.systemSider}>
        <div className={styles.siderLogo}>
          <div className={styles.logoIcon}>
            <SettingOutlined style={{ color: '#fff', fontSize: 18 }} />
          </div>
          <div className={styles.logoText}>
            <div className={styles.logoTitle}>Tenant Hub</div>
            <div className={styles.logoSubtitle}>系统管理控制台</div>
          </div>
        </div>

        <div className={styles.siderMenuWrap}>
          <div className={styles.menuSection}>
            <div className={styles.menuLabel}>系统管理</div>
            <Menu
              mode="inline"
              selectedKeys={[selectedKey]}
              openKeys={openKeys}
              className={styles.systemMenu}
              items={menuItems}
              onClick={({ key }) => handleMenuClick(key)}
              onOpenChange={(keys) => setOpenKeys(keys)}
            />
          </div>
        </div>
      </Sider>

      <Layout className={styles.systemContentLayout}>
        <Header className={styles.systemHeader}>
          <div className={styles.headerPageTitle}>
            {getLabelFromKey(selectedKey)}
          </div>

          <div className={styles.headerRight}>
            {memberships.length > 0 && (
              <span
                className={styles.workspaceSwitch}
                onClick={() => navigate('/')}
              >
                <SwapOutlined className={styles.switchIcon} />
                业务工作台
              </span>
            )}

            <Dropdown menu={{ items: userMenuItems }}>
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

        <Content className={styles.systemContent}>
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
