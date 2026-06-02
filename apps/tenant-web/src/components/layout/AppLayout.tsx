import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import styles from './AppLayout.module.scss';

const { Header, Content } = Layout;

export default function AppLayout() {
  return (
    <Layout className={styles.layout}>
      <Sidebar />
      <Layout>
        <Header className={styles.header}>
          <div className={styles.headerTitle}>租务通 Tenant Hub</div>
        </Header>
        <Content className={styles.content}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
