import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Dropdown, Spin, message, Modal, Avatar } from 'antd';
import {
  HomeTwoTone,
  SwapOutlined,
  LogoutOutlined,
  UserOutlined,
  DownOutlined,
  DashboardOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { useMemo } from 'react';
import { menuConfig, opsMenuConfig } from './menuConfig';
import { getKeyFromPath, getPathFromKey, getLabelFromKey } from './menuUtils';
import styles from './MainLayout.module.scss';

const { Header, Sider, Content } = Layout;

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

  const noOrg = memberships.length === 0;

  const menuItems = useMemo(() => {
    const baseItems = menuConfig
      .filter((item) => {
        if (item.requireOrg && noOrg) return false;
        return true;
      })
      .map(({ key, label, icon: Icon }) => ({
        key,
        icon: <Icon />,
        label,
      }));

    if (platformRole !== 'SUPER_ADMIN') return baseItems;

    return [
      ...baseItems,
      {
        key: 'ops',
        icon: <DashboardOutlined />,
        label: '运营配置',
        children: opsMenuConfig.map(({ key, label, icon: Icon }) => ({
          key,
          icon: <Icon />,
          label,
        })),
      },
    ];
  }, [noOrg, platformRole]);

  const selectedKey = useMemo(
    () => getKeyFromPath([...menuConfig, ...opsMenuConfig], location.pathname),
    [location.pathname]
  );

  const handleMenuClick = (key: string) => {
    const path = getPathFromKey([...menuConfig, ...opsMenuConfig], key);
    if (path) navigate(path);
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
      </Sider>

      <Layout className={styles.mainContentLayout}>
        <Header className={styles.mainHeader}>
          {/* Breadcrumb placeholder / page title could go here */}
          <div className={styles.headerPageTitle}>
            {getLabelFromKey([...menuConfig, ...opsMenuConfig], selectedKey)}
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
