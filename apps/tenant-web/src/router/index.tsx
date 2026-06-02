import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import MainLayout from '@/layout/MainLayout';
import {
  PageLoading,
  RequireAuth,
  RequireOrg,
  RequireSuperAdmin,
} from './guards';

/* ---------- 页面懒加载 ---------- */

// 认证
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(
  () => import('@/pages/auth/ForgotPasswordPage')
);

// 首页
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

// 维修
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

// 租客
const TenantListPage = lazy(() => import('@/pages/tenants/TenantListPage'));
const TenantDetailPage = lazy(() => import('@/pages/tenants/TenantDetailPage'));
const TenantFormPage = lazy(() => import('@/pages/tenants/TenantFormPage'));

// 同住人
const CoResidentsPage = lazy(
  () => import('@/pages/co-residents/CoResidentsPage')
);

// 出纳
const CashierJournalsPage = lazy(
  () => import('@/pages/cashier-journals/CashierJournalsPage')
);

// 发票
const InvoicesPage = lazy(() => import('@/pages/invoices/InvoicesPage'));

// 报表
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage'));

// 审计日志
const AuditLogsPage = lazy(() => import('@/pages/audit-logs/AuditLogsPage'));

// 表具
const MeterListPage = lazy(() => import('@/pages/meters/MeterListPage'));
const MeterFormPage = lazy(() => import('@/pages/meters/MeterFormPage'));
const MeterDetailPage = lazy(() => import('@/pages/meters/MeterDetailPage'));

// 设置
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));
const OrganizationPage = lazy(
  () => import('@/pages/settings/OrganizationPage')
);
const AccountPage = lazy(() => import('@/pages/settings/AccountPage'));
const PlanPage = lazy(() => import('@/pages/settings/PlanPage'));
const MembersPage = lazy(() => import('@/pages/settings/MembersPage'));
const RolesPage = lazy(() => import('@/pages/settings/RolesPage'));

// 通知中心
const NotificationsPage = lazy(
  () => import('@/pages/notifications/NotificationsPage')
);

// 退款管理
const RefundsPage = lazy(() => import('@/pages/refunds/RefundsPage'));
const RefundApprovalPage = lazy(
  () => import('@/pages/refunds/RefundApprovalPage')
);

// 资金账户
const AccountsPage = lazy(() => import('@/pages/accounts/AccountsPage'));

// 运营后台
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

/* ---------- 路由配置 ---------- */

type RouteConfig = {
  path: string;
  element: React.ReactNode;
  requireOrg?: boolean;
  requireSuperAdmin?: boolean;
};

const routes: RouteConfig[] = [
  // 首页
  { path: '/', element: <DashboardPage />, requireOrg: true },

  // 公寓
  { path: '/apartments', element: <ApartmentListPage />, requireOrg: true },
  {
    path: '/apartments/:id',
    element: <ApartmentDetailPage />,
    requireOrg: true,
  },
  { path: '/apartments/new', element: <ApartmentFormPage />, requireOrg: true },
  {
    path: '/apartments/:id/edit',
    element: <ApartmentFormPage />,
    requireOrg: true,
  },
  {
    path: '/apartments/:id/expenses',
    element: <ApartmentExpensePage />,
    requireOrg: true,
  },
  {
    path: '/apartments/:id/rooms/batch',
    element: <RoomBatchPage />,
    requireOrg: true,
  },

  // 房间
  { path: '/rooms', element: <RoomListPage />, requireOrg: true },
  { path: '/rooms/:id', element: <RoomDetailPage />, requireOrg: true },
  { path: '/rooms/new', element: <RoomFormPage />, requireOrg: true },
  { path: '/rooms/:id/edit', element: <RoomFormPage />, requireOrg: true },
  {
    path: '/rooms/:id/lease/new',
    element: <LeaseFormPage />,
    requireOrg: true,
  },
  {
    path: '/rooms/:id/lease/edit',
    element: <LeaseEditPage />,
    requireOrg: true,
  },
  {
    path: '/rooms/:id/lease/terminate',
    element: <LeaseTerminatePage />,
    requireOrg: true,
  },

  // 租约
  { path: '/leases', element: <LeasesPage />, requireOrg: true },
  { path: '/leases/:id/renew', element: <LeaseRenewPage />, requireOrg: true },
  {
    path: '/leases/:id/room-change',
    element: <LeaseRoomChangePage />,
    requireOrg: true,
  },

  // 维修
  { path: '/maintenance', element: <MaintenancePage />, requireOrg: true },
  {
    path: '/maintenance/:id',
    element: <MaintenanceDetailPage />,
    requireOrg: true,
  },

  // 押金
  { path: '/deposits', element: <DepositsPage />, requireOrg: true },
  { path: '/deposits/:id', element: <DepositDetailPage />, requireOrg: true },

  // 账单
  { path: '/bills', element: <BillListPage />, requireOrg: true },
  { path: '/bills/payment', element: <PaymentPage />, requireOrg: true },
  { path: '/bills/reading', element: <ReadingPage />, requireOrg: true },
  { path: '/bills/utility', element: <UtilityPage />, requireOrg: true },
  {
    path: '/bills/utility-import',
    element: <UtilityImportPage />,
    requireOrg: true,
  },
  {
    path: '/bills/utility-export',
    element: <UtilityExportPage />,
    requireOrg: true,
  },
  {
    path: '/bills/monthly/:id',
    element: <MonthlyDetailPage />,
    requireOrg: true,
  },
  {
    path: '/bills/meter-readings',
    element: <MeterReadingListPage />,
    requireOrg: true,
  },

  // 租客
  { path: '/tenants', element: <TenantListPage />, requireOrg: true },
  { path: '/tenants/:id', element: <TenantDetailPage />, requireOrg: true },
  { path: '/tenants/new', element: <TenantFormPage />, requireOrg: true },
  { path: '/tenants/:id/edit', element: <TenantFormPage />, requireOrg: true },

  // 同住人
  { path: '/co-residents', element: <CoResidentsPage />, requireOrg: true },

  // 出纳
  {
    path: '/cashier-journals',
    element: <CashierJournalsPage />,
    requireOrg: true,
  },

  // 发票
  { path: '/invoices', element: <InvoicesPage />, requireOrg: true },

  // 报表
  { path: '/reports', element: <ReportsPage />, requireOrg: true },

  // 审计日志
  { path: '/audit-logs', element: <AuditLogsPage />, requireOrg: true },

  // 表具
  { path: '/meters', element: <MeterListPage />, requireOrg: true },
  { path: '/meters/new', element: <MeterFormPage />, requireOrg: true },
  { path: '/meters/:id', element: <MeterDetailPage />, requireOrg: true },
  { path: '/meters/:id/edit', element: <MeterFormPage />, requireOrg: true },

  // 设置（部分无需组织）
  { path: '/settings', element: <SettingsPage /> },
  { path: '/settings/leases', element: <LeasesPage />, requireOrg: true },
  { path: '/settings/organization', element: <OrganizationPage /> },
  { path: '/settings/account', element: <AccountPage /> },
  { path: '/settings/plan', element: <PlanPage />, requireOrg: true },
  { path: '/settings/members', element: <MembersPage />, requireOrg: true },
  { path: '/settings/roles', element: <RolesPage />, requireOrg: true },

  // 通知中心
  { path: '/notifications', element: <NotificationsPage />, requireOrg: true },

  // 退款管理
  { path: '/refunds', element: <RefundsPage />, requireOrg: true },
  {
    path: '/refunds/approval',
    element: <RefundApprovalPage />,
    requireOrg: true,
  },

  // 资金账户
  { path: '/accounts', element: <AccountsPage />, requireOrg: true },

  // 运营后台
  { path: '/ops', element: <OpsDashboardPage />, requireSuperAdmin: true },
  { path: '/ops/users', element: <OpsUsersPage />, requireSuperAdmin: true },
  { path: '/ops/plans', element: <OpsPlansPage />, requireSuperAdmin: true },
  {
    path: '/ops/organizations',
    element: <OpsOrganizationsPage />,
    requireSuperAdmin: true,
  },
  { path: '/ops/roles', element: <OpsRolesPage />, requireSuperAdmin: true },
  { path: '/ops/sms', element: <OpsSmsConfigPage />, requireSuperAdmin: true },
  {
    path: '/ops/settings',
    element: <OpsSystemSettingsPage />,
    requireSuperAdmin: true,
  },
];

function wrapRoute(route: RouteConfig): React.ReactNode {
  let element = route.element;

  if (route.requireOrg) {
    element = <RequireOrg>{element}</RequireOrg>;
  }

  if (route.requireSuperAdmin) {
    element = <RequireSuperAdmin>{element}</RequireSuperAdmin>;
  }

  return <Route key={route.path} path={route.path} element={element} />;
}

export default function AppRouter() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route
          element={
            <RequireAuth>
              <MainLayout />
            </RequireAuth>
          }
        >
          {routes.map(wrapRoute)}
        </Route>
      </Routes>
    </Suspense>
  );
}
