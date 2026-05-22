import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Layout, Menu, Dropdown, Spin, message, Modal, Badge, Avatar } from "antd";
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
  DashboardOutlined,
  BellOutlined,
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
  if (pathname.startsWith("/ops")) return "ops";
  return "dashboard";
}

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, memberships, currentMembership, currentOrgId, setCurrentOrgId, signOut, platformInfo, loading, platformRole } =
    useAppSession();

  const selectedKey = useMemo(() => getMenuKeyFromPath(location.pathname), [location.pathname]);
  const noOrg = memberships.length === 0;

  const menuItems = [
    ...(noOrg
      ? []
      : [
          { key: "dashboard", icon: <HomeOutlined />, label: "首页" },
          { key: "rooms", icon: <HomeFilled />, label: "房间" },
          { key: "bills", icon: <FileTextOutlined />, label: "账单" },
          { key: "apartments", icon: <ApartmentOutlined />, label: "公寓" },
        ]),
    { key: "settings", icon: <SettingOutlined />, label: "更多" },
    ...(platformRole === "SUPER_ADMIN" ? [{ key: "ops", icon: <DashboardOutlined />, label: "运营配置" }] : []),
  ];

  const handleMenuClick = (key: string) => {
    switch (key) {
      case "dashboard": navigate("/"); break;
      case "rooms": navigate("/rooms"); break;
      case "bills": navigate("/bills"); break;
      case "apartments": navigate("/apartments"); break;
      case "settings": navigate("/settings"); break;
      case "ops": navigate("/ops"); break;
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

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        width={240}
        theme="light"
        style={{
          borderRight: "1px solid var(--th-border)",
          background: "var(--th-surface)",
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 20,
          overflow: "auto",
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: "24px 20px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderBottom: "1px solid var(--th-border-light)",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <HomeOutlined style={{ color: "#fff", fontSize: 18 }} />
          </div>
          <div>
            <div
              style={{
                fontFamily: "var(--th-font-heading)",
                fontWeight: 700,
                fontSize: 16,
                color: "var(--th-foreground)",
                lineHeight: 1.2,
              }}
            >
              {platformInfo.name}
            </div>
            <div style={{ fontSize: 11, color: "var(--th-foreground-subtle)", marginTop: 2 }}>
              公寓管理工作台
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div style={{ padding: "0 8px" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--th-foreground-subtle)",
              padding: "12px 12px 8px",
            }}
          >
            主菜单
          </div>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            style={{ height: "100%", borderRight: 0, background: "transparent" }}
            items={menuItems}
            onClick={({ key }) => handleMenuClick(key)}
          />
        </div>

        {/* Bottom section */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "16px 20px",
            borderTop: "1px solid var(--th-border-light)",
            background: "var(--th-surface)",
          }}
        >
          <div style={{ fontSize: 12, color: "var(--th-foreground-subtle)" }}>
            {session?.user?.phone}
          </div>
        </div>
      </Sider>

      <Layout style={{ marginLeft: 240 }}>
        <Header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--th-surface)",
            padding: "0 32px",
            position: "sticky",
            top: 0,
            zIndex: 10,
            backdropFilter: "blur(8px)",
            backgroundColor: "rgba(255, 255, 255, 0.92)",
          }}
        >
          {/* Breadcrumb placeholder / page title could go here */}
          <div style={{ fontFamily: "var(--th-font-heading)", fontWeight: 600, fontSize: 18, color: "var(--th-foreground)" }}>
            {menuItems.find((m) => m.key === selectedKey)?.label || ""}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* Notifications */}
            <Badge dot>
              <BellOutlined style={{ fontSize: 18, color: "var(--th-foreground-muted)", cursor: "pointer" }} />
            </Badge>

            {/* Org Switcher */}
            {memberships.length > 1 ? (
              <Dropdown
                menu={{
                  items: orgOptions,
                  selectable: true,
                  selectedKeys: currentOrgId ? [currentOrgId] : [],
                  onClick: (e) => setCurrentOrgId(e.key),
                }}
              >
                <span
                  style={{
                    color: "var(--th-foreground)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontWeight: 500,
                    fontSize: 14,
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--th-border)",
                    transition: "all var(--th-transition)",
                  }}
                  className="org-switcher-hover"
                >
                  <SwapOutlined style={{ color: "var(--th-primary)" }} />
                  {currentMembership?.organization.name || "选择组织"}
                  <DownOutlined style={{ fontSize: 10, color: "var(--th-foreground-subtle)" }} />
                </span>
              </Dropdown>
            ) : (
              <span style={{ color: "var(--th-foreground-muted)", fontSize: 14 }}>
                {currentMembership?.organization.name || (noOrg ? "未加入组织" : "")}
              </span>
            )}

            {/* User */}
            <Dropdown
              menu={{
                items: [
                  { key: "account", icon: <UserOutlined />, label: "账号设置", onClick: () => navigate("/settings/account") },
                  { key: "logout", icon: <LogoutOutlined />, label: "退出登录", onClick: handleSignOut },
                ],
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <Avatar
                  size={34}
                  style={{
                    background: "linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)",
                    fontFamily: "var(--th-font-heading)",
                    fontWeight: 600,
                  }}
                >
                  {(session?.user?.username?.[0] || session?.user?.phone?.slice(-1) || "?").toUpperCase()}
                </Avatar>
                <span style={{ color: "var(--th-foreground)", fontWeight: 500, fontSize: 14 }}>
                  {session?.user?.username || session?.user?.phone}
                </span>
                <DownOutlined style={{ fontSize: 10, color: "var(--th-foreground-subtle)" }} />
              </span>
            </Dropdown>
          </div>
        </Header>

        <Content
          style={{
            padding: "28px 32px",
            background: "var(--th-bg)",
            minHeight: "calc(100vh - 64px)",
          }}
        >
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 64 }}>
              <Spin size="large" />
            </div>
          ) : (
            <div className="page-content">
              <Outlet />
            </div>
          )}
        </Content>
      </Layout>
    </Layout>
  );
}
