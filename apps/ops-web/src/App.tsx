import { BankOutlined, HomeOutlined, LogoutOutlined, ProfileOutlined, SettingOutlined, TeamOutlined, WalletOutlined } from "@ant-design/icons";
import { Button, Layout, Menu, Select, Space, Typography, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, clearSession, readSession, writeSession } from "./api/client";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ApartmentsPage } from "./pages/ApartmentsPage";
import { LeasesPage } from "./pages/LeasesPage";
import { BillsPage } from "./pages/BillsPage";
import { OrganizationPage } from "./pages/OrganizationPage";
import { AdminPage } from "./pages/AdminPage";

type Membership = {
  organization: { id: string; name: string; code: string };
  role: { name: string };
};

const menuItems = [
  { key: "dashboard", icon: <ProfileOutlined />, label: "总览" },
  { key: "apartments", icon: <HomeOutlined />, label: "公寓" },
  { key: "leases", icon: <BankOutlined />, label: "租约" },
  { key: "bills", icon: <WalletOutlined />, label: "账单" },
  { key: "organization", icon: <TeamOutlined />, label: "组织" },
  { key: "admin", icon: <SettingOutlined />, label: "运营" }
];

export default function App() {
  const [session, setSession] = useState(readSession());
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [active, setActive] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const refreshMe = useCallback(async () => {
    if (!readSession().token) return;
    setLoading(true);
    try {
      const me = await api<{ user: { id: string; phone: string; username: string }; memberships: Membership[] }>("/auth/me");
      setMemberships(me.memberships);
      const currentOrg = readSession().organizationId || me.memberships[0]?.organization.id;
      setSession(writeSession({ user: me.user, organizationId: currentOrg }));
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

  const currentOrg = useMemo(
    () => memberships.find((item) => item.organization.id === session.organizationId)?.organization,
    [memberships, session.organizationId]
  );

  if (!session.token) {
    return (
      <>
        {contextHolder}
        <AuthPage
          onAuthed={(next) => {
            setSession(writeSession(next));
            refreshMe();
          }}
        />
      </>
    );
  }

  const page = {
    dashboard: <DashboardPage />,
    apartments: <ApartmentsPage />,
    leases: <LeasesPage />,
    bills: <BillsPage />,
    organization: <OrganizationPage memberships={memberships} onChanged={refreshMe} />,
    admin: <AdminPage />
  }[active];

  return (
    <div className="workspace">
      {contextHolder}
      <div className="topbar">
        <Space>
          <Typography.Text style={{ color: "white", fontSize: 18, fontWeight: 700 }}>Tenant Hub</Typography.Text>
          <Select
            loading={loading}
            value={session.organizationId}
            style={{ width: 220 }}
            placeholder="选择组织"
            options={memberships.map((item) => ({ value: item.organization.id, label: `${item.organization.name} · ${item.role.name}` }))}
            onChange={(organizationId) => setSession(writeSession({ organizationId }))}
          />
          {currentOrg ? <Typography.Text style={{ color: "#cfe8df" }}>编码 {currentOrg.code}</Typography.Text> : null}
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
      <Layout hasSider>
        <Layout.Sider width={184} theme="light">
          <Menu selectedKeys={[active]} mode="inline" items={menuItems} onClick={(event) => setActive(event.key)} />
        </Layout.Sider>
        <Layout.Content>{page}</Layout.Content>
      </Layout>
    </div>
  );
}
