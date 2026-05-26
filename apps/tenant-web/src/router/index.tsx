import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Spin, Empty } from 'antd';
import MainLayout from '@/layout/MainLayout';
import { useAppSession } from '@/context/AppSessionContext';
import styles from './router.module.scss';

// 懒加载页面
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/dashboard/index.tsx'));

// 公寓
const ApartmentListPage = lazy(
  () => import('@/pages/apartments/ApartmentListPage')
);
const ApartmentDetailPage = lazy(
  () => import('@/pages/apartments/ApartmentDetailPage')
);
const ApartmentFormPage = lazy(
  () => import('@/pages/apartments/ApartmentFormPage')
);
const ApartmentExpensePage = lazy(
  () => import('@/pages/apartments/ApartmentExpensePage')
);
const RoomBatchPage = lazy(() => import('@/pages/apartments/RoomBatchPage'));

// 房间
const RoomListPage = lazy(() => import('@/pages/rooms/RoomListPage'));
const RoomDetailPage = lazy(() => import('@/pages/rooms/RoomDetailPage'));
const RoomFormPage = lazy(() => import('@/pages/rooms/RoomFormPage'));
const LeaseFormPage = lazy(() => import('@/pages/rooms/LeaseFormPage'));
const LeaseEditPage = lazy(() => import('@/pages/rooms/LeaseEditPage'));
const LeaseTerminatePage = lazy(
  () => import('@/pages/rooms/LeaseTerminatePage')
);

// 租约
const LeasesPage = lazy(() => import('@/pages/leases/LeasesPage'));
const SettlementsPage = lazy(
  () => import('@/pages/settlements/SettlementsPage')
);

// 押金
const DepositsPage = lazy(() => import('@/pages/deposits/DepositsPage'));
const DepositDetailPage = lazy(
  () => import('@/pages/deposits/DepositDetailPage')
);

// 账单
const BillListPage = lazy(() => import('@/pages/bills/BillListPage'));
const PaymentPage = lazy(() => import('@/pages/bills/PaymentPage'));
const ReadingPage = lazy(() => import('@/pages/bills/ReadingPage'));
const UtilityPage = lazy(() => import('@/pages/bills/UtilityPage'));
const UtilityImportPage = lazy(() => import('@/pages/bills/UtilityImportPage'));
const UtilityExportPage = lazy(() => import('@/pages/bills/UtilityExportPage'));
const MonthlyDetailPage = lazy(() => import('@/pages/bills/MonthlyDetailPage'));
const EditItemPage = lazy(() => import('@/pages/bills/EditItemPage'));

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

  if (loading) {
    return <PageLoading />;
  }

  if (memberships.length === 0) {
    return (
      <div className={styles.centerEmpty}>
        <Empty description="请先创建或加入组织" />
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
            path="/apartments/new"
            element={
              <RequireOrg>
                <ApartmentFormPage />
              </RequireOrg>
            }
          />
          <Route
            path="/apartments/:id/edit"
            element={
              <RequireOrg>
                <ApartmentFormPage />
              </RequireOrg>
            }
          />
          <Route
            path="/apartments/:id/expenses"
            element={
              <RequireOrg>
                <ApartmentExpensePage />
              </RequireOrg>
            }
          />
          <Route
            path="/apartments/:id/rooms/batch"
            element={
              <RequireOrg>
                <RoomBatchPage />
              </RequireOrg>
            }
          />

          {/* 租约 */}
          <Route
            path="/leases"
            element={
              <RequireOrg>
                <LeasesPage />
              </RequireOrg>
            }
          />
          <Route
            path="/settlements"
            element={
              <RequireOrg>
                <SettlementsPage />
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
          <Route
            path="/rooms/new"
            element={
              <RequireOrg>
                <RoomFormPage />
              </RequireOrg>
            }
          />
          <Route
            path="/rooms/:id/edit"
            element={
              <RequireOrg>
                <RoomFormPage />
              </RequireOrg>
            }
          />
          <Route
            path="/rooms/:id/lease/new"
            element={
              <RequireOrg>
                <LeaseFormPage />
              </RequireOrg>
            }
          />
          <Route
            path="/rooms/:id/lease/edit"
            element={
              <RequireOrg>
                <LeaseEditPage />
              </RequireOrg>
            }
          />
          <Route
            path="/rooms/:id/lease/terminate"
            element={
              <RequireOrg>
                <LeaseTerminatePage />
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
            path="/bills/payment"
            element={
              <RequireOrg>
                <PaymentPage />
              </RequireOrg>
            }
          />
          <Route
            path="/bills/reading"
            element={
              <RequireOrg>
                <ReadingPage />
              </RequireOrg>
            }
          />
          <Route
            path="/bills/utility"
            element={
              <RequireOrg>
                <UtilityPage />
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
            path="/bills/utility-export"
            element={
              <RequireOrg>
                <UtilityExportPage />
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
          <Route
            path="/bills/items/:id/edit"
            element={
              <RequireOrg>
                <EditItemPage />
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
