import { useEffect, useState } from 'react';
import { Table, Tag, message, Space, Button } from 'antd';
import {
  ApartmentOutlined,
  TeamOutlined,
  HomeOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  WarningOutlined,
  SettingOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { getAdminSummary, getAdminOrganizations } from '@/api/admin';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import OpsSmsDrawer from './OpsSmsDrawer';
import OpsSystemSettingsDrawer from './OpsSystemSettingsDrawer';
import styles from './OpsDashboardPage.module.scss';

export default function OpsDashboardPage() {
  const [smsDrawerOpen, setSmsDrawerOpen] = useState(false);
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [summary, setSummary] = useState<{
    organizations: number;
    users: number;
    apartments: number;
    rooms: number;
    activeLeases: number;
    unpaidBills: number;
  }>();
  const [organizations, setOrganizations] = useState<
    Array<{
      id: string;
      name: string;
      code: string;
      status: string;
      _count?: { apartments: number; members: number; bills: number };
    }>
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getAdminSummary()
        .then(setSummary)
        .catch((e) => message.error(e.message)),
      getAdminOrganizations()
        .then(setOrganizations)
        .catch(() => undefined),
    ]).finally(() => setLoading(false));
  }, []);

  const stats = [
    {
      title: '组织',
      value: summary?.organizations ?? '-',
      icon: <TeamOutlined />,
      color: 'primary' as const,
    },
    {
      title: '用户',
      value: summary?.users ?? '-',
      icon: <ApartmentOutlined />,
      color: 'accent' as const,
    },
    {
      title: '公寓',
      value: summary?.apartments ?? '-',
      icon: <HomeOutlined />,
      color: 'success' as const,
    },
    {
      title: '房间',
      value: summary?.rooms ?? '-',
      icon: <AppstoreOutlined />,
      color: 'primary' as const,
    },
    {
      title: '生效租约',
      value: summary?.activeLeases ?? '-',
      icon: <FileTextOutlined />,
      color: 'warning' as const,
    },
    {
      title: '待处理账单',
      value: summary?.unpaidBills ?? '-',
      icon: <WarningOutlined />,
      color: 'danger' as const,
    },
  ];

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[{ label: '运营总览' }]}
        actions={
          <Space>
            <Button
              icon={<MessageOutlined />}
              onClick={() => setSmsDrawerOpen(true)}
            >
              短信配置
            </Button>
            <Button
              icon={<SettingOutlined />}
              onClick={() => setSettingsDrawerOpen(true)}
            >
              系统配置
            </Button>
          </Space>
        }
      />

      <div className={styles.opsStatsGrid}>
        {stats.map((item) => (
          <StatCard
            key={item.title}
            title={item.title}
            value={item.value}
            icon={item.icon}
            color={item.color}
          />
        ))}
      </div>

      <Table
        rowKey="id"
        dataSource={organizations}
        loading={loading}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 'max-content' }}
        columns={[
          { title: '组织', dataIndex: 'name', ellipsis: true },
          { title: '编码', dataIndex: 'code' },
          {
            title: '公寓数',
            render: (_: unknown, row: (typeof organizations)[0]) =>
              row._count?.apartments,
          },
          {
            title: '成员数',
            render: (_: unknown, row: (typeof organizations)[0]) =>
              row._count?.members,
          },
          {
            title: '账单数',
            render: (_: unknown, row: (typeof organizations)[0]) =>
              row._count?.bills,
          },
          {
            title: '状态',
            dataIndex: 'status',
            render: (value: string) => (
              <Tag color={value === 'ACTIVE' ? 'success' : 'warning'}>
                {value}
              </Tag>
            ),
          },
        ]}
      />

      <OpsSmsDrawer
        open={smsDrawerOpen}
        onClose={() => setSmsDrawerOpen(false)}
      />

      <OpsSystemSettingsDrawer
        open={settingsDrawerOpen}
        onClose={() => setSettingsDrawerOpen(false)}
      />
    </div>
  );
}
