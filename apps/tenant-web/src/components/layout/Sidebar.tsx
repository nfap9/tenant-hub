import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  HomeOutlined,
  TeamOutlined,
  FileTextOutlined,
  DollarOutlined,
  ToolOutlined,
  SettingOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import styles from './Sidebar.module.scss';

const { Sider } = Layout;

const menuItems = [
  {
    key: '/',
    icon: <DashboardOutlined />,
    label: '首页',
  },
  {
    key: '/apartments',
    icon: <HomeOutlined />,
    label: '公寓管理',
  },
  {
    key: '/tenants',
    icon: <TeamOutlined />,
    label: '租客管理',
  },
  {
    key: '/leases',
    icon: <FileTextOutlined />,
    label: '租约管理',
  },
  {
    key: '/bills',
    icon: <DollarOutlined />,
    label: '账单管理',
  },
  {
    key: '/maintenance',
    icon: <ToolOutlined />,
    label: '维修管理',
  },
  {
    key: '/settings',
    icon: <SettingOutlined />,
    label: '系统设置',
  },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const selectedKey =
    menuItems
      .slice()
      .reverse()
      .find((item) => location.pathname.startsWith(item.key))?.key || '/';

  return (
    <Sider
      width={220}
      className={styles.sider}
      theme="light"
      breakpoint="lg"
      collapsedWidth={64}
    >
      <div className={styles.logo}>
        <DashboardOutlined className={styles.logoIcon} />
        <span className={styles.logoText}>租务通</span>
      </div>

      <div className={styles.menuWrapper}>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          className={styles.menu}
        />
      </div>

      <div className={styles.footer}>
        <Menu
          mode="inline"
          selectable={false}
          items={[
            {
              key: 'logout',
              icon: <LogoutOutlined />,
              label: '退出登录',
              danger: true,
            },
          ]}
          onClick={({ key }) => {
            if (key === 'logout') logout();
          }}
          className={styles.menu}
        />
      </div>
    </Sider>
  );
}
