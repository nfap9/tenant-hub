import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Tabs,
  Tag,
  Input,
  Button,
  message,
  Spin,
  Popconfirm,
  Space,
} from 'antd';
import { EyeOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { getLeases, activateLease } from '@/api/leases';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import type { Lease, LeaseStatus } from '@/types/domain';
import { money, day } from '@/utils/format';
import { cycleLabels } from '@/pages/rooms/constants';
import styles from './LeasesPage.module.scss';

const statusLabels: Record<LeaseStatus, string> = {
  DRAFT: '草稿',
  ACTIVE: '生效中',
  TERMINATED: '已终止',
  EXPIRED: '已到期',
};

const statusColors: Record<LeaseStatus, string> = {
  DRAFT: 'default',
  ACTIVE: 'success',
  TERMINATED: 'warning',
  EXPIRED: 'error',
};

type LeaseFilter =
  | 'ALL'
  | 'ACTIVE'
  | 'DRAFT'
  | 'AUTO_RENEW'
  | 'EXPIRING_SOON'
  | 'TERMINATED';

const filterLabels: Record<LeaseFilter, string> = {
  ALL: '全部',
  ACTIVE: '有效',
  DRAFT: '草稿',
  AUTO_RENEW: '自动续约',
  EXPIRING_SOON: '近到期',
  TERMINATED: '已终止',
};

const filters: LeaseFilter[] = [
  'ALL',
  'ACTIVE',
  'DRAFT',
  'AUTO_RENEW',
  'EXPIRING_SOON',
  'TERMINATED',
];

export default function LeasesPage() {
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageLease = useHasPermission('lease:manage');
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<LeaseFilter>('ALL');
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const data = await getLeases(currentOrgId);
      setLeases(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载租约列表失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  const handleActivate = async (leaseId: string) => {
    if (!currentOrgId) return;
    try {
      await activateLease(currentOrgId, leaseId);
      message.success('租约已激活');
      loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '激活租约失败');
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredLeases = useMemo(() => {
    let result = leases;

    if (filter === 'ACTIVE') {
      result = result.filter((l) => l.status === 'ACTIVE');
    } else if (filter === 'DRAFT') {
      result = result.filter((l) => l.status === 'DRAFT');
    } else if (filter === 'AUTO_RENEW') {
      result = result.filter((l) => l.status === 'ACTIVE' && l.autoRenew);
    } else if (filter === 'EXPIRING_SOON') {
      const soon = new Date();
      soon.setDate(soon.getDate() + 30);
      result = result.filter(
        (l) => l.status === 'ACTIVE' && new Date(l.endDate) <= soon
      );
    } else if (filter === 'TERMINATED') {
      result = result.filter(
        (l) => l.status === 'TERMINATED' || l.status === 'EXPIRED'
      );
    }

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (l) =>
          l.tenantName.toLowerCase().includes(q) ||
          l.tenantPhone?.toLowerCase().includes(q) ||
          l.room?.roomNo?.toLowerCase().includes(q) ||
          l.room?.apartment?.name?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [leases, filter, search]);

  const filterCounts = useMemo(() => {
    const counts: Record<LeaseFilter, number> = {
      ALL: leases.length,
      ACTIVE: leases.filter((l) => l.status === 'ACTIVE').length,
      DRAFT: leases.filter((l) => l.status === 'DRAFT').length,
      AUTO_RENEW: leases.filter((l) => l.status === 'ACTIVE' && l.autoRenew)
        .length,
      EXPIRING_SOON: leases.filter((l) => {
        if (l.status !== 'ACTIVE') return false;
        const soon = new Date();
        soon.setDate(soon.getDate() + 30);
        return new Date(l.endDate) <= soon;
      }).length,
      TERMINATED: leases.filter(
        (l) => l.status === 'TERMINATED' || l.status === 'EXPIRED'
      ).length,
    };
    return counts;
  }, [leases]);

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[{ label: '租约' }]}
        actions={
          <Input.Search
            allowClear
            placeholder="搜索租客、手机号、房间或公寓"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onSearch={() => {}}
            className={styles.searchInput}
          />
        }
      />

      <Tabs
        activeKey={filter}
        onChange={(key) => setFilter(key as LeaseFilter)}
        items={filters.map((f) => ({
          key: f,
          label: `${filterLabels[f]} (${filterCounts[f]})`,
        }))}
        className={styles.leaseTabs}
      />

      <Spin spinning={loading}>
        {filteredLeases.length === 0 ? (
          <EmptyState
            title="暂无租约数据"
            description={
              search ? '请尝试调整搜索条件' : '当前还没有任何租约记录'
            }
          />
        ) : (
          <Table
            rowKey="id"
            dataSource={filteredLeases}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 'max-content' }}
            columns={[
              {
                title: '租客',
                render: (_: unknown, row: Lease) => (
                  <div>
                    <div>{row.tenantName}</div>
                    <div className="text-muted">{row.tenantPhone}</div>
                  </div>
                ),
              },
              {
                title: '房间',
                render: (_: unknown, row: Lease) => (
                  <div>
                    <div>{row.room?.roomNo ?? '-'}</div>
                    <div className="text-muted">
                      {row.room?.apartment?.name ?? '-'}
                    </div>
                  </div>
                ),
              },
              {
                title: '租期',
                render: (_: unknown, row: Lease) => (
                  <div>
                    <div>
                      {day(row.startDate)} ~ {day(row.endDate)}
                    </div>
                    <div className="text-muted">
                      {cycleLabels[row.cycle]}
                      {row.autoRenew ? ' · 自动续约' : ''}
                    </div>
                  </div>
                ),
              },
              {
                title: '租金',
                render: (_: unknown, row: Lease) => (
                  <span>¥{money(row.rentAmount)}</span>
                ),
              },
              {
                title: '押金',
                render: (_: unknown, row: Lease) => (
                  <span>¥{money(row.depositAmount)}</span>
                ),
              },
              {
                title: '状态',
                render: (_: unknown, row: Lease) => (
                  <Tag color={statusColors[row.status]}>
                    {statusLabels[row.status]}
                  </Tag>
                ),
              },
              {
                title: '操作',
                fixed: 'right',
                render: (_: unknown, row: Lease) => (
                  <Space>
                    <Button
                      type="link"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => navigate(`/rooms/${row.roomId}`)}
                    >
                      查看房间
                    </Button>
                    {row.status === 'DRAFT' && canManageLease && (
                      <Popconfirm
                        title="激活租约"
                        description="确认激活草稿租约？激活后将开始生成账单。"
                        onConfirm={() => handleActivate(row.id)}
                        okText="确认激活"
                        cancelText="取消"
                      >
                        <Button
                          type="link"
                          size="small"
                          icon={<PlayCircleOutlined />}
                        >
                          激活
                        </Button>
                      </Popconfirm>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        )}
      </Spin>
    </div>
  );
}
