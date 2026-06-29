import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Layout,
  Menu,
  Dropdown,
  Spin,
  message,
  Modal,
  Avatar,
  type MenuProps,
} from 'antd';
import {
  HomeTwoTone,
  SwapOutlined,
  LogoutOutlined,
  UserOutlined,
  TeamOutlined,
  DownOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { useMemo, useState, useEffect } from 'react';
import { bizMenuConfig, type MenuItemConfig } from './menuConfig';
import {
  getKeyFromPath,
  getLabelFromKey,
  getParentKeys,
  flattenMenu,
} from './menuUtils';
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
    loading,
  } = useAppSession();

  const noOrg = memberships.length === 0;

  const selectedKey = useMemo(
    () => getKeyFromPath(bizMenuConfig, location.pathname, location.search),
    [location.pathname, location.search]
  );

  const handleMenuClick = (key: string) => {
    const allStatic = flattenMenu(bizMenuConfig);
    const item = allStatic.find((i) => i.key === key);
    if (item) {
      navigate(item.path);
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

  const userMenuItems = useMemo<MenuProps['items']>(() => {
    const items: NonNullable<MenuProps['items']> = [
      {
        key: 'account',
        icon: <UserOutlined />,
        label: '个人中心',
        onClick: () => navigate('/account'),
      },
    ];
    if (!noOrg) {
      items.push({
        key: 'organization',
        icon: <TeamOutlined />,
        label: '组织设置',
        onClick: () => navigate('/organization'),
      });
    }
    items.push({ type: 'divider' });
    items.push({
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleSignOut,
    });
    return items;
  }, [navigate, noOrg]);

  const bizMenuItems = useMemo(() => {
    function buildItems(
      configs: MenuItemConfig[],
      isRoot = true
    ): MenuProps['items'] {
      return configs
        .filter((item) => !(item.requireOrg && noOrg))
        .map((item) => {
          const visibleChildren = item.children?.filter(
            (child) => !(child.requireOrg && noOrg)
          );
          const hasChildren = visibleChildren && visibleChildren.length > 0;

          return {
            key: item.key,
            icon: <item.icon />,
            label: item.label,
            className: isRoot ? styles.bizMenuItem : styles.subMenuItem,
            children: hasChildren
              ? buildItems(visibleChildren, false)
              : undefined,
          };
        });
    }

    return buildItems(bizMenuConfig);
  }, [noOrg]);

  const defaultOpenKeys = useMemo(
    () => getParentKeys(bizMenuConfig, selectedKey),
    [selectedKey]
  );
  const [openKeys, setOpenKeys] = useState(defaultOpenKeys);

  useEffect(() => {
    setOpenKeys((prev) => {
      const next = getParentKeys(bizMenuConfig, selectedKey);
      return Array.from(new Set([...prev, ...next]));
    });
  }, [selectedKey]);

  return (
    <Layout className={styles.mainLayout}>
      <Sider width={240} theme="light" className={styles.mainSider}>
        <div className={styles.siderLogo}>
          <div className={styles.logoIcon}>
            <HomeTwoTone />
          </div>
          <div>
            <div className={styles.logoTitle}>Tenant Hub</div>
            <div className={styles.logoSubtitle}>公寓管理工作台</div>
          </div>
        </div>

        <div className={styles.siderMenuWrap}>
          <div className={styles.menuSection}>
            <div className={styles.menuLabel}>业务功能</div>
            <Menu
              mode="inline"
              selectedKeys={[selectedKey]}
              openKeys={openKeys}
              className={`${styles.mainMenu} ${styles.bizMenu}`}
              items={bizMenuItems}
              onClick={({ key }) => handleMenuClick(key)}
              onOpenChange={(keys) => setOpenKeys(keys)}
            />
          </div>
        </div>
      </Sider>

      <Layout className={styles.mainContentLayout}>
        <Header className={styles.mainHeader}>
          <div className={styles.headerPageTitle}>
            {getLabelFromKey(bizMenuConfig, selectedKey)}
          </div>

          <div className={styles.headerRight}>
            <BellOutlined
              className={styles.headerIconBtn}
              onClick={() => message.warning('暂无通知')}
            />

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
