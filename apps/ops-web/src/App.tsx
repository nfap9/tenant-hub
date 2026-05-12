import { ApartmentOutlined, CrownOutlined, LogoutOutlined, MessageOutlined, ProfileOutlined, SafetyCertificateOutlined, SettingOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Empty, Layout, Menu, Space, Typography, message } from "antd";
import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { api, clearSession, readSession, writeSession } from "./api/client";

const AuthPage = lazy(() => import("./pages/AuthPage").then((module) => ({ default: module.AuthPage })));
const AdminPage = lazy(() => import("./pages/AdminPage").then((module) => ({ default: module.AdminPage })));
const OpsDashboardPage = lazy(() => import("./pages/OpsDashboardPage").then((module) => ({ default: module.OpsDashboardPage })));
const SmsConfigPage = lazy(() => import("./pages/SmsConfigPage").then((module) => ({ default: module.SmsConfigPage })));
const SystemSettingsPage = lazy(() => import("./pages/SystemSettingsPage").then((module) => ({ default: module.SystemSettingsPage })));

const menuItems = [
  { key: "dashboard", icon: <ProfileOutlined />, label: "运营总览" },
  { key: "users", icon: <UserOutlined />, label: "用户管理" },
  { key: "plans", icon: <CrownOutlined />, label: "套餐配置" },
  { key: "organizations", icon: <ApartmentOutlined />, label: "组织管理" },
  { key: "roles", icon: <SafetyCertificateOutlined />, label: "角色权限" },
  { key: "settings", icon: <SettingOutlined />, label: "系统配置" },
  { key: "sms", icon: <MessageOutlined />, label: "短信配置" }
];

export default function App() {
  const [session, setSession] = useState(readSession());
  const [platformRole, setPlatformRole] = useState("NONE");
  const [active, setActive] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const refreshMe = useCallback(async () => {
    if (!readSession().token) return;
    setLoading(true);
    try {
      const me = await api<{ user: { id: string; phone: string; username: string; effectivePlatformRole: string } }>("/auth/me");
      setPlatformRole(me.user.effectivePlatformRole);
      setSession(writeSession({ user: me.user, organizationId: undefined }));
    } catch (error) {
      messageApi.error((error as Error).message);
      clearSession();
      setSession({});
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  if (!session.token) {
    return (
      <>
        {contextHolder}
        <Suspense fallback={null}>
          <AuthPage
            onAuthed={(next) => {
              clearSession();
              setSession(writeSession(next));
              refreshMe();
            }}
          />
        </Suspense>
      </>
    );
  }

  const page = {
    dashboard: (
      <Suspense fallback={null}>
        <OpsDashboardPage />
      </Suspense>
    ),
    users: (
      <Suspense fallback={null}>
        <AdminPage section="users" />
      </Suspense>
    ),
    plans: (
      <Suspense fallback={null}>
        <AdminPage section="plans" />
      </Suspense>
    ),
    organizations: (
      <Suspense fallback={null}>
        <AdminPage section="organizations" />
      </Suspense>
    ),
    roles: (
      <Suspense fallback={null}>
        <AdminPage section="roles" />
      </Suspense>
    ),
    settings: (
      <Suspense fallback={null}>
        <SystemSettingsPage />
      </Suspense>
    ),
    sms: (
      <Suspense fallback={null}>
        <SmsConfigPage />
      </Suspense>
    )
  }[active];

  if (platformRole === "NONE") {
    return (
      <div className="workspace">
        {contextHolder}
        <div className="topbar">
          <Typography.Text style={{ color: "white", fontSize: 18, fontWeight: 700 }}>Tenant Hub 运营端</Typography.Text>
          <Button
            icon={<LogoutOutlined />}
            onClick={() => {
              clearSession();
              setSession({});
            }}
          >
            退出
          </Button>
        </div>
        <div className="no-access">
          <Empty description="当前账号没有运营平台权限，请联系平台管理员开通" />
        </div>
      </div>
    );
  }

  return (
    <div className="workspace">
      {contextHolder}
      <div className="topbar">
        <Space>
          <Typography.Text style={{ color: "white", fontSize: 18, fontWeight: 700 }}>Tenant Hub 运营端</Typography.Text>
          <Typography.Text style={{ color: "#cfe8df" }}>{loading ? "校验登录中" : session.user?.username}</Typography.Text>
        </Space>
        <Button
          icon={<LogoutOutlined />}
          onClick={() => {
            clearSession();
            setSession({});
          }}
        >
          退出
        </Button>
      </div>
      <Layout hasSider className="ops-layout">
        <Layout.Sider width={184} theme="light" className="ops-sider">
          <Menu selectedKeys={[active]} mode="inline" items={menuItems} onClick={(event) => setActive(event.key)} />
        </Layout.Sider>
        <Layout.Content className="ops-content">{page}</Layout.Content>
      </Layout>
    </div>
  );
}
