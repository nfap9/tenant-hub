import { Card, List, Avatar, Button, Tag, Descriptions, Modal } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  TeamOutlined,
  UserOutlined,
  CrownOutlined,
  LogoutOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { message } from 'antd';
import PageHeader from '@/components/ui/PageHeader';
import styles from './SettingsPage.module.scss';

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

      <Card className={styles.settingsCard}>
        <div className={styles.profileHeader}>
          <Avatar
            size={64}
            icon={<UserOutlined />}
            className={styles.avatarPrimary}
          />
          <div>
            <div className={styles.profileName}>
              {session?.user?.username || session?.user?.phone}
            </div>
            <div className={styles.profilePhone}>{session?.user?.phone}</div>
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

        <div className={styles.divider} />

        <List
          itemLayout="horizontal"
          dataSource={menuItems}
          renderItem={(item) => (
            <List.Item
              className={styles.settingsMenuItem}
              onClick={() => navigate(item.path)}
              actions={[<RightOutlined key="arrow" className="text-subtle" />]}
            >
              <List.Item.Meta
                avatar={
                  <Avatar icon={item.icon} className={styles.menuAvatar} />
                }
                title={<span className={styles.menuTitle}>{item.title}</span>}
              />
            </List.Item>
          )}
        />

        <div className={styles.divider} />

        <Button
          type="primary"
          danger
          block
          icon={<LogoutOutlined />}
          onClick={handleSignOut}
        >
          退出登录
        </Button>
      </Card>

      <div className={styles.settingsFooter}>
        {platformInfo.name} © {new Date().getFullYear()}
      </div>
    </div>
  );
}
