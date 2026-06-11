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
  DownOutlined,
  BellOutlined,
  MessageOutlined,
  PlusOutlined,
  LoadingOutlined,
  EllipsisOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { agentNewConfig, bizMenuConfig, opsMenuConfig } from './menuConfig';
import { getKeyFromPath, getLabelFromKey } from './menuUtils';
import styles from './MainLayout.module.scss';

const { Header, Sider, Content } = Layout;

interface ConversationItem {
  id: string;
  title: string;
  updatedAt: number;
  messages: { role: string }[];
  loading?: boolean;
}

function useConversationList(orgId: string) {
  const storageKey = `agent_conv_${orgId}`;
  const [conversations, setConversations] = useState<ConversationItem[]>([]);

  const read = useCallback(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setConversations(
            parsed.map((c: ConversationItem) => ({
              id: c.id,
              title: c.title,
              updatedAt: c.updatedAt,
              messages: c.messages || [],
              loading: c.loading,
            }))
          );
          return;
        }
      }
    } catch {
      // ignore
    }
    setConversations([]);
  }, [storageKey]);

  useEffect(() => {
    read();
    const handler = () => read();
    window.addEventListener('agent-conversations-change', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('agent-conversations-change', handler);
      window.removeEventListener('storage', handler);
    };
  }, [read]);

  return conversations;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays}天前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
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

  const noOrg = memberships.length === 0;
  const orgId = currentOrgId || 'default';
  const conversations = useConversationList(orgId);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const selectedKey = useMemo(
    () =>
      getKeyFromPath(
        [agentNewConfig, ...bizMenuConfig, ...opsMenuConfig],
        location.pathname,
        location.search
      ),
    [location.pathname, location.search]
  );

  const handleMenuClick = (key: string) => {
    if (key === 'agent-new') {
      navigate('/agent?action=new');
      return;
    }
    if (key === 'more-history') {
      setHistoryExpanded((v) => !v);
      return;
    }
    if (key.startsWith('conv_')) {
      const convId = key.slice(5);
      navigate(`/agent?conv=${convId}`);
      return;
    }
    const allStatic = [agentNewConfig, ...bizMenuConfig, ...opsMenuConfig];
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

  // 用户头像下拉菜单项
  const userMenuItems = useMemo<MenuProps['items']>(() => {
    const base: MenuProps['items'] = [
      {
        key: 'account',
        icon: <UserOutlined />,
        label: '账号设置',
        onClick: () => navigate('/settings/account'),
      },
    ];

    if (platformRole === 'SUPER_ADMIN') {
      base.push({ type: 'divider' });
      opsMenuConfig.forEach((item) => {
        base.push({
          key: item.key,
          icon: <item.icon />,
          label: item.label,
          onClick: () => navigate(item.path),
        });
      });
    }

    base.push({ type: 'divider' });
    base.push({
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleSignOut,
    });

    return base;
  }, [navigate, platformRole]);

  // 构建菜单 items
  const menuItems = useMemo(() => {
    const items: Array<{
      key: string;
      icon?: React.ReactNode;
      label: React.ReactNode;
      className?: string;
      style?: React.CSSProperties;
    }> = [];

    // 新对话
    items.push({
      key: agentNewConfig.key,
      icon: <PlusOutlined />,
      label: agentNewConfig.label,
    });

    // 对话历史
    const displayConversations = historyExpanded
      ? conversations
      : conversations.slice(0, 8);

    displayConversations.forEach((conv) => {
      items.push({
        key: `conv_${conv.id}`,
        icon: conv.loading ? <LoadingOutlined spin /> : <MessageOutlined />,
        label: (
          <div className={styles.convLabel}>
            <span className={styles.convTitle}>{conv.title || '新对话'}</span>
            <span className={styles.convTime}>
              {conv.loading ? '生成中...' : formatTime(conv.updatedAt)}
            </span>
          </div>
        ),
        className: styles.convMenuItem,
      });
    });

    // 更多
    if (conversations.length > 8) {
      items.push({
        key: 'more-history',
        icon: <EllipsisOutlined />,
        label: historyExpanded ? '收起' : '更多',
        className: styles.moreMenuItem,
      });
    }

    return items;
  }, [conversations, historyExpanded]);

  const bizMenuItems = useMemo(() => {
    return bizMenuConfig
      .filter((item) => {
        if (item.requireOrg && noOrg) return false;
        return true;
      })
      .map(({ key, label, icon: Icon }) => ({
        key,
        icon: <Icon />,
        label,
        className: styles.bizMenuItem,
      }));
  }, [noOrg]);

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
          {/* 智能助手区域 */}
          <div className={styles.menuSection}>
            <div className={styles.menuLabel}>智能助手</div>
            <Menu
              mode="inline"
              selectedKeys={[selectedKey]}
              className={styles.mainMenu}
              items={menuItems}
              onClick={({ key }) => handleMenuClick(key)}
            />
          </div>

          {/* 业务功能区域 */}
          <div className={styles.menuSection}>
            <div className={styles.menuLabel}>业务功能</div>
            <Menu
              mode="inline"
              selectedKeys={[selectedKey]}
              className={`${styles.mainMenu} ${styles.bizMenu}`}
              items={bizMenuItems}
              onClick={({ key }) => handleMenuClick(key)}
            />
          </div>
        </div>
      </Sider>

      <Layout className={styles.mainContentLayout}>
        <Header className={styles.mainHeader}>
          <div className={styles.headerPageTitle}>
            {getLabelFromKey(
              [agentNewConfig, ...bizMenuConfig, ...opsMenuConfig],
              selectedKey.startsWith('conv_') ? 'agent-new' : selectedKey
            )}
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
                items: userMenuItems,
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
