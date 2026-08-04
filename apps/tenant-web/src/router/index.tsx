import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Spin, Empty, Button, Space } from 'antd';
import { BuildOutlined, UserAddOutlined } from '@ant-design/icons';
import MainLayout from '@/layout/MainLayout';
import { useAppSession } from '@/context/AppSessionContext';
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
const AiModelsPage = lazy(() => import('@/pages/settings/AiModelsPage'));
const AccountPage = lazy(() => import('@/pages/settings/AccountPage'));

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
          <Route
            path="/leases/:id"
            element={
              <RequireOrg>
                <LeaseDetailPage />
              </RequireOrg>
            }
          />

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

          <Route
            path="/bills"
            element={
              <RequireOrg>
                <BillListPage />
              </RequireOrg>
            }
          />
          <Route
            path="/meter-readings"
            element={
              <RequireOrg>
                <MeterReadingListPage />
              </RequireOrg>
            }
          />

          <Route
            path="/organization"
            element={
              <RequireOrg>
                <OrganizationPage />
              </RequireOrg>
            }
          />
          <Route
            path="/ai-models"
            element={
              <RequireOrg>
                <AiModelsPage />
              </RequireOrg>
            }
          />
          <Route path="/account" element={<AccountPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
