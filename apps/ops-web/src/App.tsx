import { ApartmentOutlined, CrownOutlined, LogoutOutlined, ProfileOutlined, SafetyCertificateOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Empty, Layout, Menu, Space, Typography, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { api, clearSession, readSession, writeSession } from "./api/client";
import { AuthPage } from "./pages/AuthPage";
import { AdminPage } from "./pages/AdminPage";
import { OpsDashboardPage } from "./pages/OpsDashboardPage";

const menuItems = [
  { key: "dashboard", icon: <ProfileOutlined />, label: "运营总览" },
  { key: "users", icon: <UserOutlined />, label: "用户管理" },
  { key: "plans", icon: <CrownOutlined />, label: "套餐配置" },
  { key: "organizations", icon: <ApartmentOutlined />, label: "组织管理" },
  { key: "roles", icon: <SafetyCertificateOutlined />, label: "角色权限" }
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
        <AuthPage
          onAuthed={(next) => {
            clearSession();
            setSession(writeSession(next));
            refreshMe();
          }}
        />
      </>
    );
  }

  const page = {
    dashboard: <OpsDashboardPage />,
    users: <AdminPage section="users" />,
    plans: <AdminPage section="plans" />,
    organizations: <AdminPage section="organizations" />,
    roles: <AdminPage section="roles" />
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
