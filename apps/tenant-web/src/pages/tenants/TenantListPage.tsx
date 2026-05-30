import { useState, useEffect, useCallback } from 'react';
import { Button, Table, Tag, Input, Spin, message, Popconfirm } from 'antd';
import {
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { getTenants, deleteTenant } from '@/api/tenants';
import type { Tenant } from '@/types/domain';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import styles from './TenantListPage.module.scss';

const sourceChannelLabels: Record<string, string> = {
  PLATFORM_58: '58同城',
  DOUBAN: '豆瓣',
  BEIKE: '贝壳',
  REFERRAL: '转介绍',
  AGENT: '中介',
  WALK_IN: '上门',
  OTHER: '其他',
};

export default function TenantListPage() {
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageTenant = useHasPermission('lease:manage');

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const loadTenants = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const data = await getTenants(currentOrgId);
      setTenants(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载租客列表失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const handleDelete = async (id: string) => {
    if (!currentOrgId) return;
    try {
      await deleteTenant(currentOrgId, id);
      message.success('删除成功');
      loadTenants();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.includes(search) ||
      t.phone.includes(search) ||
      (t.idCard && t.idCard.includes(search))
  );

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '身份证号',
      dataIndex: 'idCard',
      key: 'idCard',
      render: (v?: string) => v || '-',
    },
    {
      title: '来源渠道',
      dataIndex: 'sourceChannel',
      key: 'sourceChannel',
      render: (v?: string) =>
        v ? <Tag>{sourceChannelLabels[v] || v}</Tag> : '-',
    },
    {
      title: '信用分',
      dataIndex: 'creditScore',
      key: 'creditScore',
      render: (v?: number) =>
        v !== undefined ? (
          <Tag color={v >= 80 ? 'success' : v >= 60 ? 'warning' : 'error'}>
            {v}
          </Tag>
        ) : (
          '-'
        ),
    },
    {
      title: '租约数',
      dataIndex: '_count',
      key: 'leaseCount',
      render: (_: unknown, record: Tenant) => record._count?.leases ?? 0,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: Tenant) => (
        <div className={styles.actions}>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/tenants/${record.id}`)}
          >
            查看
          </Button>
          {canManageTenant && (
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => navigate(`/tenants/${record.id}/edit`)}
            >
              编辑
            </Button>
          )}
          {canManageTenant && (
            <Popconfirm
              title="确认删除？"
              description="删除后不可恢复，且需确保租客无进行中的租约"
              onConfirm={() => handleDelete(record.id)}
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[{ label: '租客管理' }]}
        actions={
          canManageTenant && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/tenants/new')}
            >
              新增租客
            </Button>
          )
        }
      />

      <div className={styles.searchBar}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜索姓名、手机号、身份证号"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ width: 320 }}
        />
      </div>

      <Spin spinning={loading}>
        {filteredTenants.length === 0 && !loading ? (
          <EmptyState
            title="暂无租客数据"
            description="当前还没有创建任何租客档案"
            action={undefined}
          />
        ) : (
          <Table
            dataSource={filteredTenants}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 20 }}
          />
        )}
      </Spin>
    </div>
  );
}
