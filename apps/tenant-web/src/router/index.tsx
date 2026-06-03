import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Spin, Empty, Button, Space } from 'antd';
import { BuildOutlined, UserAddOutlined } from '@ant-design/icons';
import MainLayout from '@/layout/MainLayout';
import { useAppSession } from '@/context/AppSessionContext';
import styles from './router.module.scss';

// 懒加载页面
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/dashboard/index.tsx'));
const AgentChatPage = lazy(() => import('@/pages/agent/AgentChatPage'));

// 公寓
const ApartmentListPage = lazy(
  () => import('@/pages/apartments/ApartmentListPage')
);
const ApartmentDetailPage = lazy(
  () => import('@/pages/apartments/ApartmentDetailPage')
);
// 房间
const RoomListPage = lazy(() => import('@/pages/rooms/RoomListPage'));
const RoomDetailPage = lazy(() => import('@/pages/rooms/RoomDetailPage'));

// 租约
const LeasesPage = lazy(() => import('@/pages/leases/LeasesPage'));

// 押金
const DepositsPage = lazy(() => import('@/pages/deposits/DepositsPage'));
const DepositDetailPage = lazy(
  () => import('@/pages/deposits/DepositDetailPage')
);

// 收支记录
const TransactionsPage = lazy(
  () => import('@/pages/transactions/TransactionsPage')
);

// 账单
const BillListPage = lazy(() => import('@/pages/bills/BillListPage'));
const UtilityImportPage = lazy(() => import('@/pages/bills/UtilityImportPage'));
const MonthlyDetailPage = lazy(() => import('@/pages/bills/MonthlyDetailPage'));

// 设置
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));
const MyLeasesPage = lazy(() => import('@/pages/leases/LeasesPage'));
const OrganizationPage = lazy(
  () => import('@/pages/settings/OrganizationPage')
);
const AccountPage = lazy(() => import('@/pages/settings/AccountPage'));
const PlanPage = lazy(() => import('@/pages/settings/PlanPage'));

// 运营配置
const OpsDashboardPage = lazy(() => import('@/pages/ops/OpsDashboardPage'));
const OpsUsersPage = lazy(() => import('@/pages/ops/OpsUsersPage'));
const OpsPlansPage = lazy(() => import('@/pages/ops/OpsPlansPage'));
const OpsOrganizationsPage = lazy(
  () => import('@/pages/ops/OpsOrganizationsPage')
);
const OpsRolesPage = lazy(() => import('@/pages/ops/OpsRolesPage'));
const OpsSmsConfigPage = lazy(() => import('@/pages/ops/OpsSmsConfigPage'));
const OpsSystemSettingsPage = lazy(
  () => import('@/pages/ops/OpsSystemSettingsPage')
);

function PageLoading() {
  return (
    <div className={styles.pageLoading}>
      <Spin size="large" />
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAppSession();

  if (loading) {
    return <PageLoading />;
  }

  if (!session?.token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
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

function RequireOrg({ children }: { children: React.ReactNode }) {
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

export default function AppRouter() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <MainLayout />
            </RequireAuth>
          }
        >
          <Route
            path="/"
            element={
              <RequireOrg>
                <DashboardPage />
              </RequireOrg>
            }
          />

          {/* 智能助手 */}
          <Route
            path="/agent"
            element={
              <RequireOrg>
                <AgentChatPage />
              </RequireOrg>
            }
          />

          {/* 公寓 */}
          <Route
            path="/apartments"
            element={
              <RequireOrg>
                <ApartmentListPage />
              </RequireOrg>
            }
          />
          <Route
            path="/apartments/:id"
            element={
              <RequireOrg>
                <ApartmentDetailPage />
              </RequireOrg>
            }
          />
          <Route
            path="/leases"
            element={
              <RequireOrg>
                <LeasesPage />
              </RequireOrg>
            }
          />
          {/* 房间 */}
          <Route
            path="/rooms"
            element={
              <RequireOrg>
                <RoomListPage />
              </RequireOrg>
            }
          />
          <Route
            path="/rooms/:id"
            element={
              <RequireOrg>
                <RoomDetailPage />
              </RequireOrg>
            }
          />
          {/* 押金 */}
          <Route
            path="/deposits"
            element={
              <RequireOrg>
                <DepositsPage />
              </RequireOrg>
            }
          />
          <Route
            path="/deposits/:id"
            element={
              <RequireOrg>
                <DepositDetailPage />
              </RequireOrg>
            }
          />

          {/* 收支记录 */}
          <Route
            path="/transactions"
            element={
              <RequireOrg>
                <TransactionsPage />
              </RequireOrg>
            }
          />

          {/* 账单 */}
          <Route
            path="/bills"
            element={
              <RequireOrg>
                <BillListPage />
              </RequireOrg>
            }
          />
          <Route
            path="/bills/utility-import"
            element={
              <RequireOrg>
                <UtilityImportPage />
              </RequireOrg>
            }
          />
          <Route
            path="/bills/monthly/:id"
            element={
              <RequireOrg>
                <MonthlyDetailPage />
              </RequireOrg>
            }
          />
          {/* 设置 */}
          <Route path="/settings" element={<SettingsPage />} />
          <Route
            path="/settings/leases"
            element={
              <RequireOrg>
                <MyLeasesPage />
              </RequireOrg>
            }
          />
          <Route path="/settings/organization" element={<OrganizationPage />} />
          <Route path="/settings/account" element={<AccountPage />} />
          <Route
            path="/settings/plan"
            element={
              <RequireOrg>
                <PlanPage />
              </RequireOrg>
            }
          />

          {/* 运营配置 */}
          <Route
            path="/ops"
            element={
              <RequireSuperAdmin>
                <OpsDashboardPage />
              </RequireSuperAdmin>
            }
          />
          <Route
            path="/ops/users"
            element={
              <RequireSuperAdmin>
                <OpsUsersPage />
              </RequireSuperAdmin>
            }
          />
          <Route
            path="/ops/plans"
            element={
              <RequireSuperAdmin>
                <OpsPlansPage />
              </RequireSuperAdmin>
            }
          />
          <Route
            path="/ops/organizations"
            element={
              <RequireSuperAdmin>
                <OpsOrganizationsPage />
              </RequireSuperAdmin>
            }
          />
          <Route
            path="/ops/roles"
            element={
              <RequireSuperAdmin>
                <OpsRolesPage />
              </RequireSuperAdmin>
            }
          />
          <Route
            path="/ops/sms"
            element={
              <RequireSuperAdmin>
                <OpsSmsConfigPage />
              </RequireSuperAdmin>
            }
          />
          <Route
            path="/ops/settings"
            element={
              <RequireSuperAdmin>
                <OpsSystemSettingsPage />
              </RequireSuperAdmin>
            }
          />
        </Route>
      </Routes>
    </Suspense>
  );
}
