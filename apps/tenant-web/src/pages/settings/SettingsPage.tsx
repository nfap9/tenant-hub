import { Card, List, Avatar, Button, Tag, Descriptions, Modal } from "antd";
import { useNavigate } from "react-router-dom";
import {
  FileTextOutlined,
  TeamOutlined,
  UserOutlined,
  CrownOutlined,
  LogoutOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { useAppSession } from "@/context/AppSessionContext";
import { message } from "antd";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { session, memberships, currentMembership, signOut, platformInfo } = useAppSession();

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

  const menuItems = [
    ...(memberships.length === 0
      ? []
      : [
          {
            title: "我的租约",
            icon: <FileTextOutlined />,
            path: "/settings/leases",
          },
        ]),
    {
      title: "组织管理",
      icon: <TeamOutlined />,
      path: "/settings/organization",
    },
    {
      title: "账号设置",
      icon: <UserOutlined />,
      path: "/settings/account",
    },
    ...(memberships.length === 0
      ? []
      : [
          {
            title: "套餐订阅",
            icon: <CrownOutlined />,
            path: "/settings/plan",
          },
        ]),
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>更多</h2>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <Avatar size={64} icon={<UserOutlined />} style={{ backgroundColor: "#146c5c" }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              {session?.user?.username || session?.user?.phone}
            </div>
            <div style={{ color: "#71827b" }}>{session?.user?.phone}</div>
          </div>
        </div>
        {currentMembership && (
          <Descriptions size="small" column={2}>
            <Descriptions.Item label="当前组织">
              <Tag color="green">{currentMembership.organization.name}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="角色">
              <Tag>{currentMembership.role.name}</Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <List
          itemLayout="horizontal"
          dataSource={menuItems}
          renderItem={(item) => (
            <List.Item
              style={{ cursor: "pointer" }}
              onClick={() => navigate(item.path)}
              actions={[<RightOutlined key="arrow" style={{ color: "#bbb" }} />]}
            >
              <List.Item.Meta
                avatar={<Avatar icon={item.icon} style={{ backgroundColor: "#146c5c" }} />}
                title={item.title}
              />
            </List.Item>
          )}
        />
      </Card>

      <Card>
        <Button type="primary" danger block icon={<LogoutOutlined />} onClick={handleSignOut}>
          退出登录
        </Button>
      </Card>

      <div style={{ textAlign: "center", marginTop: 24, color: "#bbb", fontSize: 12 }}>
        {platformInfo.name} © {new Date().getFullYear()}
      </div>
    </div>
  );
}
