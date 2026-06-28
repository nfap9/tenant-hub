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
  Form,
  Input,
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
  FolderOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  agentNewConfig,
  bizMenuConfig,
  opsMenuConfig,
  type MenuItemConfig,
} from './menuConfig';
import {
  getKeyFromPath,
  getLabelFromKey,
  getParentKeys,
  flattenMenu,
} from './menuUtils';
import {
  getConversations,
  updateConversation,
  deleteConversation as deleteServerConversation,
  type ServerConversation,
} from '@/api/agent';
import {
  removeConversation,
  dispatchConversationsChange,
} from '@/pages/agent/storage';
import styles from './MainLayout.module.scss';

const { Header, Sider, Content } = Layout;

interface ConversationItem {
  id: string;
  serverId?: string;
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
            serverId: c.serverId,
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

  useEffect(() => {
    const handler = (e: CustomEvent<{ id: string }>) => {
      setServerList((prev) => prev.filter((c) => c.id !== e.detail.id));
    };
    window.addEventListener(
      'agent-conversation-deleted',
      handler as EventListener
    );
    return () => {
      window.removeEventListener(
        'agent-conversation-deleted',
        handler as EventListener
      );
    };
  }, []);

  // 合并本地缓存和后端列表
  const merged = useMemo(() => {
    const localMap = new Map(conversations.map((c) => [c.id, c]));
    const serverItems: ConversationItem[] = serverList
      .filter((s) => !localMap.has(s.id))
      .map((s) => ({
        id: s.id,
        serverId: s.id,
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
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingConv, setEditingConv] = useState<ConversationItem | null>(null);
  const [editLoading, setEditLoading] = useState(false);

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
    const allStatic = [
      agentNewConfig,
      ...flattenMenu(bizMenuConfig),
      ...opsMenuConfig,
    ];
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

  const handleArchive = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const conv = conversations.find((c) => c.id === id);
      if (conv?.serverId) {
        try {
          await updateConversation(conv.serverId, { archived: true });
        } catch {
          message.error('操作失败');
          return;
        }
      }
      // 从本地缓存移除
      try {
        const cacheKey = `agent_conv_${orgId}_cache`;
        const stored = localStorage.getItem(cacheKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const remaining = parsed.filter((c: { id: string }) => c.id !== id);
            localStorage.setItem(cacheKey, JSON.stringify(remaining));
            window.dispatchEvent(new Event('agent-conversations-change'));
          }
        }
      } catch {
        // ignore
      }
      message.success('已归档');
      refresh();
      const params = new URLSearchParams(location.search);
      if (params.get('conv') === id) {
        navigate('/agent');
      }
    },
    [conversations, orgId, refresh, location.search, navigate]
  );

  const handleDeleteConv = useCallback(
    async (id: string) => {
      const conv = conversations.find((c) => c.id === id);
      if (!conv) return;

      try {
        if (conv.serverId) {
          await deleteServerConversation(conv.serverId);
        }
        removeConversation(`agent_conv_${orgId}_cache`, conv.id);
        dispatchConversationsChange();
        window.dispatchEvent(
          new CustomEvent('agent-conversation-deleted', {
            detail: { id: conv.id },
          })
        );
        const params = new URLSearchParams(location.search);
        if (params.get('conv') === conv.id) {
          navigate('/agent', { replace: true });
        }
        message.success('对话已删除');
      } catch {
        message.error('删除失败，请重试');
      }
    },
    [conversations, orgId, location.search, navigate]
  );

  const handleEditClick = useCallback((conv: ConversationItem) => {
    setEditingConv(conv);
    setEditModalOpen(true);
  }, []);

  const handleSaveTitle = useCallback(
    async (values: { title: string }) => {
      if (!editingConv) return;

      setEditLoading(true);
      try {
        const title = values.title.trim();
        if (editingConv.serverId) {
          await updateConversation(editingConv.serverId, { title });
        }
        const cacheKey = `agent_conv_${orgId}_cache`;
        const stored = localStorage.getItem(cacheKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const updated = parsed.map((c: { id: string; title?: string }) =>
              c.id === editingConv.id ? { ...c, title } : c
            );
            localStorage.setItem(cacheKey, JSON.stringify(updated));
            window.dispatchEvent(new Event('agent-conversations-change'));
          }
        }
        setEditModalOpen(false);
        message.success('标题已更新');
      } catch {
        message.error('更新失败，请重试');
      } finally {
        setEditLoading(false);
      }
    },
    [editingConv, orgId]
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
      const actionItems: MenuProps['items'] = [
        {
          key: 'edit',
          icon: <EditOutlined />,
          label: '编辑标题',
          onClick: (e) => {
            e.domEvent.stopPropagation();
            handleEditClick(conv);
          },
        },
        {
          key: 'archive',
          icon: <FolderOutlined />,
          label: '归档',
          onClick: (e) => {
            e.domEvent.stopPropagation();
            handleArchive(conv.id, e.domEvent as React.MouseEvent);
          },
        },
        {
          key: 'delete',
          icon: <DeleteOutlined />,
          label: '删除',
          danger: true,
          onClick: (e) => {
            e.domEvent.stopPropagation();
            Modal.confirm({
              title: '删除对话',
              content: '删除后将无法恢复，确定继续吗？',
              okText: '删除',
              cancelText: '取消',
              okButtonProps: { danger: true },
              onOk: () => handleDeleteConv(conv.id),
            });
          },
        },
      ];

      items.push({
        key: `conv_${conv.id}`,
        icon: conv.loading ? <LoadingOutlined spin /> : <MessageOutlined />,
        label: (
          <div className={styles.convLabel}>
            <span className={styles.convTitle}>{conv.title || '新对话'}</span>
            <div className={styles.convMeta}>
              <span className={styles.convTime}>
                {conv.loading ? '生成中...' : formatTime(conv.updatedAt)}
              </span>
              <Dropdown
                menu={{ items: actionItems }}
                placement="bottomRight"
                trigger={['click']}
              >
                <Button
                  type="text"
                  size="small"
                  className={styles.actionBtn}
                  icon={<EllipsisOutlined />}
                  onClick={(e) => e.stopPropagation()}
                />
              </Dropdown>
            </div>
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
  }, [
    conversations,
    historyExpanded,
    handleArchive,
    handleDeleteConv,
    handleEditClick,
  ]);

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

      {/* 编辑标题 Modal */}
      <Modal
        title="编辑标题"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        footer={null}
        width={400}
        destroyOnClose
      >
        <Form
          layout="vertical"
          initialValues={{ title: editingConv?.title || '' }}
          onFinish={handleSaveTitle}
        >
          <Form.Item
            label="会话标题"
            name="title"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入会话标题" maxLength={50} showCount />
          </Form.Item>
          <Form.Item className={styles.editTitleFooter}>
            <Button onClick={() => setEditModalOpen(false)}>取消</Button>
            <Button type="primary" htmlType="submit" loading={editLoading}>
              保存
            </Button>
          </Form.Item>
        </Form>
      </Modal>

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
