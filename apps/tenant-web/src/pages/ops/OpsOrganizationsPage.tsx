import { useEffect, useState } from 'react';
import { Select, Table, Tag, message } from 'antd';
import { getAdminOrganizations } from '@/api/admin';
import { apiClient } from '@/api/client';
import PageHeader from '@/components/ui/PageHeader';
import styles from './OpsOrganizationsPage.module.scss';

export default function OpsOrganizationsPage() {
  const [orgs, setOrgs] = useState<
    Array<{
      id: string;
      name: string;
      code: string;
      status: string;
      _count?: { apartments: number; members: number };
      subscriptions?: Array<{
        active: boolean;
        endsAt?: string;
        plan?: { name: string };
      }>;
    }>
  >([]);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    getAdminOrganizations()
      .then(setOrgs)
      .catch((e) => message.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleStatusChange = async (orgId: string, status: string) => {
    try {
      await apiClient(`/admin/organizations/${orgId}/status`, {
        method: 'PUT',
        body: { status },
      });
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '更新失败');
    }
  };

  return (
    <div className="page-content">
      <PageHeader breadcrumb={[{ label: '运营端' }, { label: '组织管理' }]} />

      <Table
        rowKey="id"
        loading={loading}
        dataSource={orgs}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 'max-content' }}
        columns={[
          { title: '组织', dataIndex: 'name', ellipsis: true },
          { title: '编码', dataIndex: 'code' },
          {
            title: '当前套餐',
            render: (_: unknown, row: (typeof orgs)[0]) => {
              const subscription = row.subscriptions?.find(
                (item) => item.active
              );
              return subscription ? (
                <Tag color="success">{subscription.plan?.name}</Tag>
              ) : (
                <Tag>未购买</Tag>
              );
            },
          },
          {
            title: '有效期',
            render: (_: unknown, row: (typeof orgs)[0]) => {
              const subscription = row.subscriptions?.find(
                (item) => item.active
              );
              return subscription?.endsAt
                ? new Date(subscription.endsAt).toLocaleDateString()
                : '-';
            },
          },
          {
            title: '公寓',
            render: (_: unknown, row: (typeof orgs)[0]) =>
              row._count?.apartments,
          },
          {
            title: '成员',
            render: (_: unknown, row: (typeof orgs)[0]) => row._count?.members,
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
          {
            title: '操作',
            render: (_: unknown, row: (typeof orgs)[0]) => (
              <Select
                value={row.status}
                className={styles.statusSelect}
                size="small"
                options={['ACTIVE', 'SUSPENDED', 'DELETED'].map((value) => ({
                  value,
                  label: value,
                }))}
                onChange={(status) => handleStatusChange(row.id, status)}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
