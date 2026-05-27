import { Card, Avatar, Button, Tag, Modal, Row, Col } from 'antd';
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
import DetailSection from '@/components/ui/DetailSection';
import DetailItem from '@/components/ui/DetailItem';
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

        <div className={styles.divider} />

        {currentMembership && (
          <DetailSection title="当前组织信息" className={styles.orgInfoSection}>
            <Row gutter={[24, 0]}>
              <Col span={12}>
                <DetailItem label="当前组织">
                  <Tag color="success">
                    {currentMembership.organization.name}
                  </Tag>
                </DetailItem>
              </Col>
              <Col span={12}>
                <DetailItem label="角色">
                  <Tag>{currentMembership.role.name}</Tag>
                </DetailItem>
              </Col>
            </Row>
          </DetailSection>
        )}

        <div className={styles.divider} />

        <div>
          {menuItems.map((item) => (
            <div
              key={item.path}
              className={styles.settingsMenuItem}
              onClick={() => navigate(item.path)}
            >
              <div className={styles.menuItemContent}>
                <Avatar icon={item.icon} className={styles.menuAvatar} />
                <span className={styles.menuTitle}>{item.title}</span>
              </div>
              <RightOutlined className="text-subtle" />
            </div>
          ))}
        </div>

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
