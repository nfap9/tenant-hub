import { Card, List, Avatar, Button, Tag, Descriptions, Modal } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  FileTextOutlined,
  TeamOutlined,
  UserOutlined,
  CrownOutlined,
  LogoutOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { message } from 'antd';
import PageHeader from '@/components/ui/PageHeader';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { session, memberships, currentMembership, signOut, platformInfo } =
    useAppSession();

  const handleSignOut = () => {
    Modal.confirm({
      title: '确认退出登录？',
      okText: '退出',
      cancelText: '取消',
      onOk: () => {
        signOut();
        message.success('已退出登录');
      },
    });
  };

  const menuItems = [
    ...(memberships.length === 0
      ? []
      : [
          {
            title: '我的租约',
            icon: <FileTextOutlined />,
            path: '/settings/leases',
          },
        ]),
    {
      title: '组织管理',
      icon: <TeamOutlined />,
      path: '/settings/organization',
    },
    {
      title: '账号设置',
      icon: <UserOutlined />,
      path: '/settings/account',
    },
    ...(memberships.length === 0
      ? []
      : [
          {
            title: '套餐订阅',
            icon: <CrownOutlined />,
            path: '/settings/plan',
          },
        ]),
  ];

  return (
    <div className="page-content">
      <PageHeader breadcrumb={[{ label: '设置' }]} />

      <Card
        style={{
          marginBottom: 16,
          borderRadius: 'var(--th-radius-lg)',
          boxShadow: 'var(--th-shadow)',
        }}
        bodyStyle={{ padding: 'var(--th-space-6)' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 16,
          }}
        >
          <Avatar
            size={64}
            icon={<UserOutlined />}
            style={{ backgroundColor: 'var(--th-primary)', flexShrink: 0 }}
          />
          <div className="page-content">
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                fontFamily: 'var(--th-font-heading)',
                color: 'var(--th-foreground)',
              }}
            >
              {session?.user?.username || session?.user?.phone}
            </div>
            <div style={{ color: 'var(--th-foreground-muted)', fontSize: 14 }}>
              {session?.user?.phone}
            </div>
          </div>
        </div>
        {currentMembership && (
          <Descriptions size="small" column={2}>
            <Descriptions.Item label="当前组织">
              <Tag color="success">{currentMembership.organization.name}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="角色">
              <Tag>{currentMembership.role.name}</Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      <Card
        style={{
          marginBottom: 16,
          borderRadius: 'var(--th-radius-lg)',
          boxShadow: 'var(--th-shadow)',
        }}
        bodyStyle={{ padding: 0 }}
      >
        <List
          itemLayout="horizontal"
          dataSource={menuItems}
          renderItem={(item) => (
            <List.Item
              style={{
                cursor: 'pointer',
                padding: 'var(--th-space-4) var(--th-space-6)',
                transition: 'var(--th-transition)',
              }}
              onClick={() => navigate(item.path)}
              actions={[
                <RightOutlined
                  key="arrow"
                  style={{ color: 'var(--th-foreground-subtle)' }}
                />,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <Avatar
                    icon={item.icon}
                    style={{ backgroundColor: 'var(--th-primary)' }}
                  />
                }
                title={
                  <span
                    style={{ fontWeight: 500, color: 'var(--th-foreground)' }}
                  >
                    {item.title}
                  </span>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      <Card
        style={{
          borderRadius: 'var(--th-radius-lg)',
          boxShadow: 'var(--th-shadow)',
        }}
        bodyStyle={{ padding: 'var(--th-space-4)' }}
      >
        <Button
          type="primary"
          danger
          block
          icon={<LogoutOutlined />}
          onClick={handleSignOut}
          size="large"
        >
          退出登录
        </Button>
      </Card>

      <div
        style={{
          textAlign: 'center',
          marginTop: 24,
          color: 'var(--th-foreground-subtle)',
          fontSize: 12,
        }}
      >
        {platformInfo.name} © {new Date().getFullYear()}
      </div>
    </div>
  );
}
