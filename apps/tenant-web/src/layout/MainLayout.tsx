import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Layout,
  Menu,
  Dropdown,
  Spin,
  message,
  Modal,
  Avatar,
  List,
  Button,
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
  InboxOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { agentNewConfig, bizMenuConfig, opsMenuConfig } from './menuConfig';
import { getKeyFromPath, getLabelFromKey } from './menuUtils';
import {
  getConversations,
  updateConversation,
  type ServerConversation,
} from '@/api/agent';
import styles from './MainLayout.module.scss';

const { Header, Sider, Content } = Layout;

interface ConversationItem {
  id: string;
  title: string;
  updatedAt: number;
  loading?: boolean;
}

function useConversationList(orgId: string) {
  const storageKey = `agent_conv_${orgId}_cache`;
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [serverList, setServerList] = useState<ServerConversation[]>([]);

  const readLocal = useCallback((): ConversationItem[] => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.map((c: ConversationItem) => ({
            id: c.id,
            title: c.title,
            updatedAt: c.updatedAt,
            loading: c.loading,
          }));
        }
      }
    } catch {
      // ignore
    }
    return [];
  }, [storageKey]);

  const loadServer = useCallback(async () => {
    try {
      const res = await getConversations({ limit: 20 });
      setServerList(res.items);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setConversations(readLocal());
    loadServer();
  }, [readLocal, loadServer, orgId]);

  useEffect(() => {
    const handler = () => setConversations(readLocal());
    window.addEventListener('agent-conversations-change', handler);
    return () => {
      window.removeEventListener('agent-conversations-change', handler);
    };
  }, [readLocal]);

  // 合并本地缓存和后端列表
  const merged = useMemo(() => {
    const localMap = new Map(conversations.map((c) => [c.id, c]));
    const serverItems = serverList
      .filter((s) => !localMap.has(s.id))
      .map((s) => ({
        id: s.id,
        title: s.title,
        updatedAt: new Date(s.updatedAt).getTime(),
        loading: false,
      }));
    return [...conversations, ...serverItems].sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
  }, [conversations, serverList]);

  return { conversations: merged, refresh: loadServer };
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
  const { conversations, refresh } = useConversationList(orgId);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archivedList, setArchivedList] = useState<ServerConversation[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);

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
    if (key === 'archived') {
      loadArchived();
      setArchiveModalOpen(true);
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

  const loadArchived = useCallback(async () => {
    setArchiveLoading(true);
    try {
      const res = await getConversations({ archived: true, limit: 50 });
      setArchivedList(res.items);
    } catch {
      message.error('加载归档失败');
    } finally {
      setArchiveLoading(false);
    }
  }, []);

  const handleUnarchive = useCallback(
    async (id: string) => {
      try {
        await updateConversation(id, { archived: false });
        message.success('已取消归档');
        setArchivedList((prev) => prev.filter((c) => c.id !== id));
        refresh();
      } catch {
        message.error('操作失败');
      }
    },
    [refresh]
  );

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
      : conversations.slice(0, 10);

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
    if (conversations.length > 10) {
      items.push({
        key: 'more-history',
        icon: <EllipsisOutlined />,
        label: historyExpanded ? '收起' : '更多',
        className: styles.moreMenuItem,
      });
    }

    // 归档入口
    items.push({
      key: 'archived',
      icon: <InboxOutlined />,
      label: '归档会话',
      className: styles.archivedMenuItem,
    });

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

      {/* 归档会话 Modal */}
      <Modal
        title="归档会话"
        open={archiveModalOpen}
        onCancel={() => setArchiveModalOpen(false)}
        footer={null}
        width={480}
      >
        <List
          loading={archiveLoading}
          dataSource={archivedList}
          locale={{ emptyText: '暂无归档会话' }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="unarchive"
                  size="small"
                  onClick={() => handleUnarchive(item.id)}
                >
                  取消归档
                </Button>,
                <Button
                  key="open"
                  size="small"
                  type="link"
                  onClick={() => {
                    setArchiveModalOpen(false);
                    navigate(`/agent?conv=${item.id}`);
                  }}
                >
                  打开
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={item.title || '新对话'}
                description={formatTime(new Date(item.updatedAt).getTime())}
              />
            </List.Item>
          )}
        />
      </Modal>
    </Layout>
  );
}
