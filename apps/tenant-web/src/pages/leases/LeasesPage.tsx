// PAGE-207: 租约列表页面
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Tabs, Tag, Input, Button, message, Spin, Tooltip } from 'antd';
import {
  EyeOutlined,
  ReloadOutlined,
  SwapOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { getLeases } from '@/api/leases';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import type { Lease, LeaseStatus } from '@/types/domain';
import { money, day } from '@/utils/format';
import { cycleLabels } from '@/pages/rooms/constants';
import styles from './LeasesPage.module.scss';

const statusLabels: Record<LeaseStatus, string> = {
  DRAFT: '草稿',
  ACTIVE: '生效中',
  EXPIRING_SOON: '即将到期',
  TERMINATING: '退租中',
  TERMINATED: '已终止',
  EXPIRED: '已到期',
  ENDED: '已结束',
};

const statusColors: Record<LeaseStatus, string> = {
  DRAFT: 'default',
  ACTIVE: 'success',
  EXPIRING_SOON: 'warning',
  TERMINATING: 'warning',
  TERMINATED: 'warning',
  EXPIRED: 'default',
  ENDED: 'default',
};

type LeaseFilter =
  | 'ALL'
  | 'ACTIVE'
  | 'AUTO_RENEW'
  | 'EXPIRING_SOON'
  | 'TERMINATED';

const filterLabels: Record<LeaseFilter, string> = {
  ALL: '全部',
  ACTIVE: '有效',
  AUTO_RENEW: '自动续约',
  EXPIRING_SOON: '近到期',
  TERMINATED: '已终止',
};

const filters: LeaseFilter[] = [
  'ALL',
  'ACTIVE',
  'AUTO_RENEW',
  'EXPIRING_SOON',
  'TERMINATED',
];

export default function LeasesPage() {
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
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

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredLeases = useMemo(() => {
    let result = leases;

    if (filter === 'ACTIVE') {
      result = result.filter((l) => l.status === 'ACTIVE');
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
                render: (_: unknown, row: Lease) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const end = new Date(row.endDate);
                  end.setHours(0, 0, 0, 0);
                  const daysLeft = Math.ceil(
                    (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                  );
                  const isExpiringSoon =
                    row.status === 'ACTIVE' && daysLeft <= 30 && daysLeft >= 0;
                  const isExpired = daysLeft < 0;
                  return (
                    <div>
                      <div>
                        {day(row.startDate)} ~ {day(row.endDate)}
                      </div>
                      <div className="text-muted">
                        {cycleLabels[row.cycle]}
                        {row.autoRenew ? ' · 自动续约' : ''}
                        {isExpiringSoon && (
                          <Tooltip title={`剩余 ${daysLeft} 天到期`}>
                            <Tag
                              color="warning"
                              style={{ marginLeft: 8, fontSize: 12 }}
                              icon={<WarningOutlined />}
                            >
                              剩 {daysLeft} 天
                            </Tag>
                          </Tooltip>
                        )}
                        {isExpired && row.status === 'ACTIVE' && (
                          <Tag
                            color="error"
                            style={{ marginLeft: 8, fontSize: 12 }}
                          >
                            已超期 {-daysLeft} 天
                          </Tag>
                        )}
                      </div>
                    </div>
                  );
                },
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
                  <div className={styles.actions}>
                    <Button
                      type="link"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => navigate(`/rooms/${row.roomId}`)}
                    >
                      查看房间
                    </Button>
                    {row.status === 'ACTIVE' && (
                      <>
                        <Button
                          type="link"
                          size="small"
                          icon={<ReloadOutlined />}
                          onClick={() => navigate(`/leases/${row.id}/renew`)}
                        >
                          续租
                        </Button>
                        <Button
                          type="link"
                          size="small"
                          icon={<SwapOutlined />}
                          onClick={() =>
                            navigate(`/leases/${row.id}/room-change`)
                          }
                        >
                          换房
                        </Button>
                      </>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Spin>
    </div>
  );
}
