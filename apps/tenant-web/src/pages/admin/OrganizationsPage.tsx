import { useEffect, useState } from 'react';
import { Table, Tag } from 'antd';
import { listAllOrganizations, type AdminOrganization } from '@/api/admin';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<AdminOrganization[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    listAllOrganizations()
      .then(setOrgs)
      .catch(() => setOrgs([]))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    {
      title: '组织名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '编码',
      dataIndex: 'code',
      key: 'code',
      render: (code: string) => <Tag>{code}</Tag>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text?: string | null) => text || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'ACTIVE' ? 'success' : 'default'}>
          {status === 'ACTIVE' ? '活跃' : '已暂停'}
        </Tag>
      ),
    },
    {
      title: '成员数',
      key: 'memberCount',
      render: (_: unknown, record: AdminOrganization) =>
        record._count?.members ?? 0,
    },
    {
      title: '公寓数',
      key: 'apartmentCount',
      render: (_: unknown, record: AdminOrganization) =>
        record._count?.apartments ?? 0,
    },
    {
      title: '默认 AI 模型',
      dataIndex: 'aiModelDefault',
      key: 'aiModelDefault',
      render: (text?: string | null) => text || <Tag>系统默认</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleDateString('zh-CN'),
    },
  ];

  return (
    <div className="page-content">
      <PageHeader breadcrumb={[{ label: '系统管理' }, { label: '组织管理' }]} />

      {!loading && orgs.length === 0 ? (
        <EmptyState title="暂无组织" description="系统中还没有任何组织" />
      ) : (
        <Table
          dataSource={orgs}
          columns={columns}
          rowKey={(record) => record.id}
          loading={loading}
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      )}
    </div>
  );
}
