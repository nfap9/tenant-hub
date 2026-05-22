import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Layout, Menu, Dropdown, Spin, message, Modal, Alert, Button } from "antd";
import {
  HomeOutlined,
  ApartmentOutlined,
  HomeFilled,
  FileTextOutlined,
  SettingOutlined,
  SwapOutlined,
  LogoutOutlined,
  UserOutlined,
  DownOutlined,
} from "@ant-design/icons";
import { useAppSession } from "@/context/AppSessionContext";
import { useMemo } from "react";

const { Header, Sider, Content } = Layout;

function getMenuKeyFromPath(pathname: string): string {
  if (pathname === "/") return "dashboard";
  if (pathname.startsWith("/apartments")) return "apartments";
  if (pathname.startsWith("/rooms")) return "rooms";
  if (pathname.startsWith("/bills")) return "bills";
  if (pathname.startsWith("/settings")) return "settings";
  return "dashboard";
}

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, memberships, currentMembership, currentOrgId, setCurrentOrgId, signOut, platformInfo, loading } =
    useAppSession();

  const selectedKey = useMemo(() => getMenuKeyFromPath(location.pathname), [location.pathname]);

  const menuItems = [
    { key: "dashboard", icon: <HomeOutlined />, label: "首页" },
    { key: "rooms", icon: <HomeFilled />, label: "房间" },
    { key: "bills", icon: <FileTextOutlined />, label: "账单" },
    { key: "apartments", icon: <ApartmentOutlined />, label: "公寓" },
    { key: "settings", icon: <SettingOutlined />, label: "更多" },
  ];

  const handleMenuClick = (key: string) => {
    switch (key) {
      case "dashboard":
        navigate("/");
        break;
      case "rooms":
        navigate("/rooms");
        break;
      case "bills":
        navigate("/bills");
        break;
      case "apartments":
        navigate("/apartments");
        break;
      case "settings":
        navigate("/settings");
        break;
    }
  };

  const orgOptions = useMemo(
    () =>
      memberships.map((m) => ({
        key: m.organization.id,
        label: m.organization.name,
      })),
    [memberships]
  );

  const handleSignOut = () => {
    Modal.confirm({
      title: "确认退出登录？",
      okText: "退出",
      cancelText: "取消",
      onOk: () => {
        signOut();
        message.success("已退出登录");
      },
    });
  };

  const noOrg = memberships.length === 0;

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#146c5c",
          padding: "0 24px",
        }}
      >
        <div style={{ color: "#fff", fontSize: 18, fontWeight: 600 }}>
          {platformInfo.logoUrl ? (
            <img src={platformInfo.logoUrl} alt={platformInfo.name} style={{ height: 32, marginRight: 8 }} />
          ) : null}
          {platformInfo.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {memberships.length > 1 ? (
            <Dropdown
              menu={{
                items: orgOptions,
                selectable: true,
                selectedKeys: currentOrgId ? [currentOrgId] : [],
                onClick: (e) => setCurrentOrgId(e.key),
              }}
            >
              <span style={{ color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <SwapOutlined />
                {currentMembership?.organization.name || "选择组织"}
                <DownOutlined style={{ fontSize: 10 }} />
              </span>
            </Dropdown>
          ) : (
            <span style={{ color: "rgba(255,255,255,0.85)" }}>
              {currentMembership?.organization.name || (noOrg ? "未加入组织" : "")}
            </span>
          )}
          <Dropdown
            menu={{
              items: [
                { key: "account", icon: <UserOutlined />, label: "账号设置", onClick: () => navigate("/settings/account") },
                { key: "logout", icon: <LogoutOutlined />, label: "退出登录", onClick: handleSignOut },
              ],
            }}
          >
            <span style={{ color: "#fff", cursor: "pointer" }}>
              <UserOutlined style={{ marginRight: 4 }} />
              {session?.user?.username || session?.user?.phone}
            </span>
          </Dropdown>
        </div>
      </Header>

      <Layout>
        <Sider width={200} theme="light" style={{ borderRight: "1px solid #f0f0f0" }}>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            style={{ height: "100%", borderRight: 0 }}
            items={menuItems}
            onClick={({ key }) => handleMenuClick(key)}
          />
        </Sider>

        <Layout style={{ padding: "24px", background: "#f4f2ec" }}>
          <Content
            style={{
              background: "#fff",
              borderRadius: 8,
              padding: 24,
              minHeight: 280,
            }}
          >
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 64 }}>
                <Spin size="large" />
              </div>
            ) : (
              <>
                {noOrg && location.pathname !== "/settings/organization" && (
                  <Alert
                    message="你还没有加入任何组织"
                    description="请先创建或加入一个组织，才能开始使用系统功能。"
                    type="warning"
                    showIcon
                    style={{ marginBottom: 24 }}
                    action={
                      <Button type="primary" onClick={() => navigate("/settings/organization")}>
                        去创建/加入
                      </Button>
                    }
                  />
                )}
                <Outlet />
              </>
            )}
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
