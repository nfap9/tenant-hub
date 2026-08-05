import { Outlet, useNavigate } from 'react-router-dom';
import {
  Layout,
  Dropdown,
  Avatar,
  Spin,
  message,
  Modal,
  type MenuProps,
} from 'antd';
import {
  LogoutOutlined,
  DownOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { useMemo } from 'react';
import styles from './AccountLayout.module.scss';

const { Header, Content } = Layout;

export default function AccountLayout() {
  const navigate = useNavigate();
  const { session, systemRole, memberships, signOut, loading } =
    useAppSession();

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

  const goBack = () => {
    navigate(-1);
  };

  const userMenuItems = useMemo<MenuProps['items']>(
    () => [
      ...(systemRole
        ? [
            {
              key: 'admin',
              icon: <ArrowLeftOutlined />,
              label: '系统管理控制台',
              onClick: () => navigate('/admin'),
            },
          ]
        : []),
      ...(memberships.length > 0
        ? [
            {
              key: 'workspace',
              icon: <ArrowLeftOutlined />,
              label: '业务工作台',
              onClick: () => navigate('/biz'),
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
    [navigate, systemRole, memberships.length, signOut]
  );

  return (
    <Layout className={styles.accountLayout}>
      <Header className={styles.accountHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.backBtn} onClick={goBack}>
            <ArrowLeftOutlined />
            返回
          </span>
          <span className={styles.headerTitle}>个人中心</span>
        </div>
        <div className={styles.headerRight}>
          <Dropdown menu={{ items: userMenuItems }}>
            <span className={styles.userTrigger}>
              <Avatar size={32} className={styles.userAvatar}>
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
      <Content className={styles.accountContent}>
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
  );
}
