import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Spin, Empty, Button, Space } from 'antd';
import { BuildOutlined, UserAddOutlined } from '@ant-design/icons';
import MainLayout from '@/layout/MainLayout';
import SystemLayout from '@/layout/SystemLayout';
import AccountLayout from '@/layout/AccountLayout';
import { useAppSession } from '@/context/AppSessionContext';
import { isSystemAdmin } from '@/utils/permissions';
import styles from './router.module.scss';

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/dashboard/index.tsx'));

const ApartmentListPage = lazy(
  () => import('@/pages/apartments/ApartmentListPage')
);
const ApartmentDetailPage = lazy(
  () => import('@/pages/apartments/ApartmentDetailPage')
);

const RoomListPage = lazy(() => import('@/pages/rooms/RoomListPage'));
const RoomDetailPage = lazy(() => import('@/pages/rooms/RoomDetailPage'));

const LeasesPage = lazy(() => import('@/pages/leases/LeasesPage'));
const LeaseDetailPage = lazy(() => import('@/pages/leases/LeaseDetailPage'));

const BillListPage = lazy(() => import('@/pages/bills/BillListPage'));
const MeterReadingListPage = lazy(
  () => import('@/pages/meter-readings/MeterReadingListPage')
);

const OrganizationPage = lazy(
  () => import('@/pages/settings/OrganizationPage')
);
const AccountPage = lazy(() => import('@/pages/settings/AccountPage'));

// 系统管理页面
const AdminDashboardPage = lazy(
  () => import('@/pages/admin/AdminDashboardPage')
);
const AiModelsPage = lazy(() => import('@/pages/settings/AiModelsPage'));
const PresetRolesPage = lazy(() => import('@/pages/admin/PresetRolesPage'));
const OrganizationsPage = lazy(() => import('@/pages/admin/OrganizationsPage'));
const UsersPage = lazy(() => import('@/pages/admin/UsersPage'));

function PageLoading() {
  return (
    <div className={styles.pageLoading}>
      <Spin size="large" />
    </div>
  );
}

/** 已登录守卫：无 token 跳转登录 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAppSession();

  if (loading) return <PageLoading />;
  if (!session?.token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** 系统角色守卫：非系统管理员/运营人员跳转业务工作台 */
function RequireSystemRole({ children }: { children: React.ReactNode }) {
  const { systemRole, loading } = useAppSession();

  if (loading) return <PageLoading />;
  if (!systemRole) return <Navigate to="/biz" replace />;
  return <>{children}</>;
}

/** 仅系统管理员守卫 */
function RequireSystemAdmin({ children }: { children: React.ReactNode }) {
  const { systemRole, loading } = useAppSession();

  if (loading) return <PageLoading />;
  if (!isSystemAdmin(systemRole)) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

/** 组织守卫：无组织时引导创建或加入 */
function RequireOrg({ children }: { children: React.ReactNode }) {
  const { memberships, loading } = useAppSession();
  const navigate = useNavigate();

  if (loading) return <PageLoading />;

  if (memberships.length === 0) {
    return (
      <div className={styles.centerEmpty}>
        <Empty description="请先创建或加入组织">
          <Space className={styles.noOrgActions}>
            <Button
              icon={<UserAddOutlined />}
              onClick={() => navigate('/account?action=join')}
            >
              加入组织
            </Button>
            <Button
              type="primary"
              icon={<BuildOutlined />}
              onClick={() => navigate('/account?action=create')}
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
        {/* ── 公开路由 ── */}
        <Route path="/login" element={<LoginPage />} />

        {/* ── 个人中心（独立布局，所有登录用户） ── */}
        <Route
          element={
            <RequireAuth>
              <AccountLayout />
            </RequireAuth>
          }
        >
          <Route path="/account" element={<AccountPage />} />
        </Route>

        {/* ── 业务工作台（RequireOrg + MainLayout） ── */}
        <Route
          element={
            <RequireAuth>
              <MainLayout />
            </RequireAuth>
          }
        >
          <Route
            path="/biz"
            element={
              <RequireOrg>
                <DashboardPage />
              </RequireOrg>
            }
          />
          <Route
            path="/biz/apartments"
            element={
              <RequireOrg>
                <ApartmentListPage />
              </RequireOrg>
            }
          />
          <Route
            path="/biz/apartments/:id"
            element={
              <RequireOrg>
                <ApartmentDetailPage />
              </RequireOrg>
            }
          />
          <Route
            path="/biz/leases"
            element={
              <RequireOrg>
                <LeasesPage />
              </RequireOrg>
            }
          />
          <Route
            path="/biz/leases/:id"
            element={
              <RequireOrg>
                <LeaseDetailPage />
              </RequireOrg>
            }
          />
          <Route
            path="/biz/rooms"
            element={
              <RequireOrg>
                <RoomListPage />
              </RequireOrg>
            }
          />
          <Route
            path="/biz/rooms/:id"
            element={
              <RequireOrg>
                <RoomDetailPage />
              </RequireOrg>
            }
          />
          <Route
            path="/biz/bills"
            element={
              <RequireOrg>
                <BillListPage />
              </RequireOrg>
            }
          />
          <Route
            path="/biz/meter-readings"
            element={
              <RequireOrg>
                <MeterReadingListPage />
              </RequireOrg>
            }
          />
          <Route
            path="/biz/organization"
            element={
              <RequireOrg>
                <OrganizationPage />
              </RequireOrg>
            }
          />
        </Route>

        {/* ── 系统管理控制台（RequireSystemRole + SystemLayout） ── */}
        <Route
          element={
            <RequireAuth>
              <RequireSystemRole>
                <SystemLayout />
              </RequireSystemRole>
            </RequireAuth>
          }
        >
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/ai-models" element={<AiModelsPage />} />
          <Route path="/admin/preset-roles" element={<PresetRolesPage />} />
          <Route path="/admin/organizations" element={<OrganizationsPage />} />
          <Route
            path="/admin/users"
            element={
              <RequireSystemAdmin>
                <UsersPage />
              </RequireSystemAdmin>
            }
          />
        </Route>

        {/* ── 兜底重定向 ── */}
        <Route path="*" element={<Navigate to="/biz" replace />} />
      </Routes>
    </Suspense>
  );
}
