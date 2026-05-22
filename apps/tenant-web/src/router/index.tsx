import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Spin } from "antd";
import MainLayout from "@/layout/MainLayout";
import { useAppSession } from "@/context/AppSessionContext";

// 懒加载页面
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));

// 公寓
const ApartmentListPage = lazy(() => import("@/pages/apartments/ApartmentListPage"));
const ApartmentDetailPage = lazy(() => import("@/pages/apartments/ApartmentDetailPage"));
const ApartmentFormPage = lazy(() => import("@/pages/apartments/ApartmentFormPage"));
const ApartmentExpensePage = lazy(() => import("@/pages/apartments/ApartmentExpensePage"));
const RoomBatchPage = lazy(() => import("@/pages/apartments/RoomBatchPage"));

// 房间
const RoomListPage = lazy(() => import("@/pages/rooms/RoomListPage"));
const RoomFormPage = lazy(() => import("@/pages/rooms/RoomFormPage"));
const LeaseFormPage = lazy(() => import("@/pages/rooms/LeaseFormPage"));
const LeaseEditPage = lazy(() => import("@/pages/rooms/LeaseEditPage"));
const LeaseTerminatePage = lazy(() => import("@/pages/rooms/LeaseTerminatePage"));

// 账单
const BillListPage = lazy(() => import("@/pages/bills/BillListPage"));
const PaymentPage = lazy(() => import("@/pages/bills/PaymentPage"));
const ReadingPage = lazy(() => import("@/pages/bills/ReadingPage"));
const UtilityPage = lazy(() => import("@/pages/bills/UtilityPage"));
const UtilityImportPage = lazy(() => import("@/pages/bills/UtilityImportPage"));
const UtilityExportPage = lazy(() => import("@/pages/bills/UtilityExportPage"));
const MonthlyDetailPage = lazy(() => import("@/pages/bills/MonthlyDetailPage"));
const EditItemPage = lazy(() => import("@/pages/bills/EditItemPage"));

// 设置
const SettingsPage = lazy(() => import("@/pages/settings/SettingsPage"));
const MyLeasesPage = lazy(() => import("@/pages/settings/MyLeasesPage"));
const OrganizationPage = lazy(() => import("@/pages/settings/OrganizationPage"));
const AccountPage = lazy(() => import("@/pages/settings/AccountPage"));
const PlanPage = lazy(() => import("@/pages/settings/PlanPage"));

function PageLoading() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
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
          <Route path="/" element={<DashboardPage />} />

          {/* 公寓 */}
          <Route path="/apartments" element={<ApartmentListPage />} />
          <Route path="/apartments/:id" element={<ApartmentDetailPage />} />
          <Route path="/apartments/new" element={<ApartmentFormPage />} />
          <Route path="/apartments/:id/edit" element={<ApartmentFormPage />} />
          <Route path="/apartments/:id/expenses" element={<ApartmentExpensePage />} />
          <Route path="/apartments/:id/rooms/batch" element={<RoomBatchPage />} />

          {/* 房间 */}
          <Route path="/rooms" element={<RoomListPage />} />
          <Route path="/rooms/new" element={<RoomFormPage />} />
          <Route path="/rooms/:id/edit" element={<RoomFormPage />} />
          <Route path="/rooms/:id/lease/new" element={<LeaseFormPage />} />
          <Route path="/rooms/:id/lease/edit" element={<LeaseEditPage />} />
          <Route path="/rooms/:id/lease/terminate" element={<LeaseTerminatePage />} />

          {/* 账单 */}
          <Route path="/bills" element={<BillListPage />} />
          <Route path="/bills/payment" element={<PaymentPage />} />
          <Route path="/bills/reading" element={<ReadingPage />} />
          <Route path="/bills/utility" element={<UtilityPage />} />
          <Route path="/bills/utility-import" element={<UtilityImportPage />} />
          <Route path="/bills/utility-export" element={<UtilityExportPage />} />
          <Route path="/bills/monthly/:id" element={<MonthlyDetailPage />} />
          <Route path="/bills/items/:id/edit" element={<EditItemPage />} />

          {/* 设置 */}
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/leases" element={<MyLeasesPage />} />
          <Route path="/settings/organization" element={<OrganizationPage />} />
          <Route path="/settings/account" element={<AccountPage />} />
          <Route path="/settings/plan" element={<PlanPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
