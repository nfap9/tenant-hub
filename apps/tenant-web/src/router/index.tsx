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
const LeaseRenewPage = lazy(() => import('@/pages/leases/LeaseRenewPage'));
const LeaseRoomChangePage = lazy(
  () => import('@/pages/leases/LeaseRoomChangePage')
);

// 维修工单
const MaintenancePage = lazy(
  () => import('@/pages/maintenance/MaintenancePage')
);
const MaintenanceDetailPage = lazy(
  () => import('@/pages/maintenance/MaintenanceDetailPage')
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
const MeterReadingListPage = lazy(
  () => import('@/pages/bills/MeterReadingListPage')
);

// 设置
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));
const MyLeasesPage = lazy(() => import('@/pages/leases/LeasesPage'));
const OrganizationPage = lazy(
  () => import('@/pages/settings/OrganizationPage')
);
const AccountPage = lazy(() => import('@/pages/settings/AccountPage'));
const PlanPage = lazy(() => import('@/pages/settings/PlanPage'));

// 租客
const TenantListPage = lazy(() => import('@/pages/tenants/TenantListPage'));
const TenantDetailPage = lazy(() => import('@/pages/tenants/TenantDetailPage'));
const TenantFormPage = lazy(() => import('@/pages/tenants/TenantFormPage'));

// 同住人
const CoResidentsPage = lazy(
  () => import('@/pages/co-residents/CoResidentsPage')
);

// 出纳日记账
const CashierJournalsPage = lazy(
  () => import('@/pages/cashier-journals/CashierJournalsPage')
);

// 发票管理
const InvoicesPage = lazy(() => import('@/pages/invoices/InvoicesPage'));

// 财务报表
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage'));

// 审计日志
const AuditLogsPage = lazy(() => import('@/pages/audit-logs/AuditLogsPage'));

// 房东合同
const LandlordContractListPage = lazy(
  () => import('@/pages/landlord-contracts/LandlordContractListPage')
);
const LandlordPaymentListPage = lazy(
  () => import('@/pages/landlord-payments/LandlordPaymentListPage')
);
const LandlordContractFormPage = lazy(
  () => import('@/pages/landlord-contracts/LandlordContractFormPage')
);
const LandlordContractDetailPage = lazy(
  () => import('@/pages/landlord-contracts/LandlordContractDetailPage')
);

// 表具
const MeterListPage = lazy(() => import('@/pages/meters/MeterListPage'));
const MeterFormPage = lazy(() => import('@/pages/meters/MeterFormPage'));
const MeterDetailPage = lazy(() => import('@/pages/meters/MeterDetailPage'));

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
            path="/leases/:id/renew"
            element={
              <RequireOrg>
                <LeaseRenewPage />
              </RequireOrg>
            }
          />
          <Route
            path="/leases/:id/room-change"
            element={
              <RequireOrg>
                <LeaseRoomChangePage />
              </RequireOrg>
            }
          />
          {/* 维修工单 */}
          <Route
            path="/maintenance"
            element={
              <RequireOrg>
                <MaintenancePage />
              </RequireOrg>
            }
          />
          <Route
            path="/maintenance/:id"
            element={
              <RequireOrg>
                <MaintenanceDetailPage />
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
            path="/bills/meter-readings"
            element={
              <RequireOrg>
                <MeterReadingListPage />
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

          {/* 租客 */}
          <Route
            path="/tenants"
            element={
              <RequireOrg>
                <TenantListPage />
              </RequireOrg>
            }
          />
          <Route
            path="/tenants/:id"
            element={
              <RequireOrg>
                <TenantDetailPage />
              </RequireOrg>
            }
          />
          <Route
            path="/tenants/new"
            element={
              <RequireOrg>
                <TenantFormPage />
              </RequireOrg>
            }
          />
          <Route
            path="/tenants/:id/edit"
            element={
              <RequireOrg>
                <TenantFormPage />
              </RequireOrg>
            }
          />

          {/* 同住人 */}
          <Route
            path="/co-residents"
            element={
              <RequireOrg>
                <CoResidentsPage />
              </RequireOrg>
            }
          />
          {/* 出纳日记账 */}
          <Route
            path="/cashier-journals"
            element={
              <RequireOrg>
                <CashierJournalsPage />
              </RequireOrg>
            }
          />
          {/* 发票管理 */}
          <Route
            path="/invoices"
            element={
              <RequireOrg>
                <InvoicesPage />
              </RequireOrg>
            }
          />
          {/* 财务报表 */}
          <Route
            path="/reports"
            element={
              <RequireOrg>
                <ReportsPage />
              </RequireOrg>
            }
          />
          {/* 房东合同 */}
          <Route
            path="/landlord-contracts"
            element={
              <RequireOrg>
                <LandlordContractListPage />
              </RequireOrg>
            }
          />
          <Route
            path="/landlord-payments"
            element={
              <RequireOrg>
                <LandlordPaymentListPage />
              </RequireOrg>
            }
          />
          <Route
            path="/landlord-contracts/new"
            element={
              <RequireOrg>
                <LandlordContractFormPage />
              </RequireOrg>
            }
          />
          <Route
            path="/landlord-contracts/:id"
            element={
              <RequireOrg>
                <LandlordContractDetailPage />
              </RequireOrg>
            }
          />
          <Route
            path="/landlord-contracts/:id/edit"
            element={
              <RequireOrg>
                <LandlordContractFormPage />
              </RequireOrg>
            }
          />

          {/* 审计日志 */}
          <Route
            path="/audit-logs"
            element={
              <RequireOrg>
                <AuditLogsPage />
              </RequireOrg>
            }
          />

          {/* 表具 */}
          <Route
            path="/meters"
            element={
              <RequireOrg>
                <MeterListPage />
              </RequireOrg>
            }
          />
          <Route
            path="/meters/new"
            element={
              <RequireOrg>
                <MeterFormPage />
              </RequireOrg>
            }
          />
          <Route
            path="/meters/:id"
            element={
              <RequireOrg>
                <MeterDetailPage />
              </RequireOrg>
            }
          />
          <Route
            path="/meters/:id/edit"
            element={
              <RequireOrg>
                <MeterFormPage />
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
