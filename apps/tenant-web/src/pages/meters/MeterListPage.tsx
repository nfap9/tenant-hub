import { useState, useEffect, useCallback } from 'react';
import { Button, Table, Tag, Spin, message, Popconfirm } from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { getMeters, deleteMeter } from '@/api/meters';
import type { Meter } from '@/types/domain';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import styles from './MeterListPage.module.scss';

const meterTypeLabels: Record<string, string> = {
  WATER: '水表',
  POWER: '电表',
  GAS: '气表',
};

const statusLabels: Record<string, string> = {
  ACTIVE: '在用',
  REMOVED: '已拆除',
};

const statusColors: Record<string, string> = {
  ACTIVE: 'success',
  REMOVED: 'default',
};

export default function MeterListPage() {
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManage = useHasPermission('apartment:manage');

  const [meters, setMeters] = useState<Meter[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const data = await getMeters(currentOrgId);
      setMeters(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载表具列表失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (id: string) => {
    if (!currentOrgId) return;
    try {
      await deleteMeter(currentOrgId, id);
      message.success('删除成功');
      loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  const columns = [
    {
      title: '表具名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '表具编号',
      dataIndex: 'meterNo',
      key: 'meterNo',
      render: (v?: string) => v || '-',
    },
    {
      title: '类型',
      dataIndex: 'meterType',
      key: 'meterType',
      render: (v: string) => meterTypeLabels[v] || v,
    },
    {
      title: '所属公寓',
      dataIndex: 'apartment',
      key: 'apartment',
      render: (v?: { name: string }) => v?.name || '-',
    },
    {
      title: '所属房间',
      dataIndex: 'room',
      key: 'room',
      render: (v?: { roomNo: string }) => v?.roomNo || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => (
        <Tag color={statusColors[v] || 'default'}>{statusLabels[v] || v}</Tag>
      ),
    },
    {
      title: '读数记录',
      dataIndex: '_count',
      key: 'readingsCount',
      render: (_: unknown, record: Meter) => record._count?.readings ?? 0,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: Meter) => (
        <div className={styles.actions}>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/meters/${record.id}`)}
          >
            查看
          </Button>
          {canManage && (
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => navigate(`/meters/${record.id}/edit`)}
            >
              编辑
            </Button>
          )}
          {canManage && (
            <Popconfirm
              title="确认删除？"
              description="删除后不可恢复"
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
        breadcrumb={[{ label: '表具管理' }]}
        actions={
          canManage && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/meters/new')}
            >
              新增表具
            </Button>
          )
        }
      />

      <Spin spinning={loading}>
        {meters.length === 0 && !loading ? (
          <EmptyState
            title="暂无表具数据"
            description="当前还没有创建任何表具"
            action={
              canManage
                ? {
                    label: '新增表具',
                    onClick: () => navigate('/meters/new'),
                  }
                : undefined
            }
          />
        ) : (
          <Table
            dataSource={meters}
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
