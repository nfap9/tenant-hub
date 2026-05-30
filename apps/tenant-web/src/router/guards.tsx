import { Navigate, useNavigate } from 'react-router-dom';
import { Empty, Button, Space, Spin } from 'antd';
import { BuildOutlined, UserAddOutlined } from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import styles from './router.module.scss';

export function PageLoading() {
  return (
    <div className={styles.pageLoading}>
      <Spin size="large" />
    </div>
  );
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAppSession();

  if (loading) {
    return <PageLoading />;
  }

  if (!session?.token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const { platformRole, loading } = useAppSession();

  if (loading) {
    return <PageLoading />;
  }

  if (platformRole !== 'SUPER_ADMIN') {
    return (
      <div className={styles.centerEmpty}>
        <Empty description="当前账号没有运营平台权限，请联系平台管理员开通" />
      </div>
    );
  }

  return <>{children}</>;
}

export function RequireOrg({ children }: { children: React.ReactNode }) {
  const { memberships, loading } = useAppSession();
  const navigate = useNavigate();

  if (loading) {
    return <PageLoading />;
  }

  if (memberships.length === 0) {
    return (
      <div className={styles.centerEmpty}>
        <Empty description="请先创建或加入组织">
          <Space className={styles.noOrgActions}>
            <Button
              icon={<UserAddOutlined />}
              onClick={() => navigate('/settings/organization?action=join')}
            >
              加入组织
            </Button>
            <Button
              type="primary"
              icon={<BuildOutlined />}
              onClick={() => navigate('/settings/organization?action=create')}
            >
              创建组织
            </Button>
          </Space>
        </Empty>
      </div>
    );
  }

  return <>{children}</>;
}
