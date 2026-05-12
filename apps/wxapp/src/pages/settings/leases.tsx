import { useState, useCallback, useMemo } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { useAppSession } from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { Card, EmptyState, Badge, Input } from '../../components/ui';
import { money, day } from '../../utils/format';
import type { Lease, LeaseStatus } from '../../types/domain';

const statusLabels: Record<LeaseStatus, string> = {
  ACTIVE: '生效中',
  TERMINATED: '已终止',
  EXPIRED: '已到期'
};

const toneForStatus: Record<LeaseStatus, 'success' | 'warning' | 'danger'> = {
  ACTIVE: 'success',
  TERMINATED: 'warning',
  EXPIRED: 'danger'
};

type LeaseFilter = 'ALL' | 'ACTIVE' | 'AUTO_RENEW' | 'EXPIRING_SOON' | 'TERMINATED';

const filterLabels: Record<LeaseFilter, string> = {
  ALL: '全部',
  ACTIVE: '有效',
  AUTO_RENEW: '自动续约',
  EXPIRING_SOON: '近到期',
  TERMINATED: '已终止'
};

export default function LeasesPage() {
  const { currentOrgId } = useAppSession();
  const [leases, setLeases] = useState<Lease[]>([]);
  const [filter, setFilter] = useState<LeaseFilter>('ALL');
  const [search, setSearch] = useState('');

  const loadLeases = useCallback(async () => {
    if (!currentOrgId) return;
    try {
      const data = await apiClient<Lease[]>('/leases', { organizationId: currentOrgId });
      setLeases(data);
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : '加载失败', icon: 'none' });
    }
  }, [currentOrgId]);

  useDidShow(() => {
    loadLeases();
  });

  usePullDownRefresh(() => {
    loadLeases().finally(() => Taro.stopPullDownRefresh());
  });

  const filteredLeases = useMemo(() => {
    let result = leases;

    if (filter === 'ACTIVE') {
      result = result.filter((l) => l.status === 'ACTIVE');
    } else if (filter === 'AUTO_RENEW') {
      result = result.filter((l) => l.status === 'ACTIVE' && l.autoRenew);
    } else if (filter === 'EXPIRING_SOON') {
      const soon = new Date();
      soon.setDate(soon.getDate() + 30);
      result = result.filter((l) => l.status === 'ACTIVE' && new Date(l.endDate) <= soon);
    } else if (filter === 'TERMINATED') {
      result = result.filter((l) => l.status === 'TERMINATED' || l.status === 'EXPIRED');
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

  if (!currentOrgId) {
    return (
      <View className="page-container">
        <Card><EmptyState emoji="🏢" title="尚未选择组织" subtitle="请先从更多页中选择一个组织" /></Card>
      </View>
    );
  }

  return (
    <View className="page-container">
      <Card>
        <Input
          value={search}
          onChange={setSearch}
          placeholder="搜索租客、电话、房间号或公寓"
        />
        <View style={{ display: 'flex', flexWrap: 'wrap', gap: '12rpx', marginTop: '24rpx' }}>
          {(Object.keys(filterLabels) as LeaseFilter[]).map((key) => (
            <View
              key={key}
              onClick={() => setFilter(key)}
              style={{
                padding: '12rpx 24rpx',
                borderRadius: '32rpx',
                backgroundColor: filter === key ? '#0d9488' : '#f1f5f9',
                border: filter === key ? '2rpx solid #0d9488' : '2rpx solid #e2e8f0'
              }}
            >
              <Text style={{
                fontSize: '24rpx',
                color: filter === key ? '#fff' : '#64748b',
                fontWeight: filter === key ? 'bold' : 'normal'
              }}>
                {filterLabels[key]}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card title="所有租约" subtitle={`共 ${filteredLeases.length} 份`}>
        {filteredLeases.length === 0 ? (
          <EmptyState emoji="📄" title="暂无租约" subtitle={search ? '请尝试其他搜索条件' : '请到房间页签约入住'} />
        ) : null}
        {filteredLeases.map((lease) => (
          <View key={lease.id} className="lease-card">
            <View className="detail-row">
              <View>
                <Text className="card-title">{lease.tenantName}</Text>
                <Text className="text-muted">{lease.room?.apartment?.name} · {lease.room?.roomNo}</Text>
              </View>
              <Badge tone={toneForStatus[lease.status]}>{statusLabels[lease.status]}</Badge>
            </View>
            <View className="detail-row">
              <Text className="text-muted">{day(lease.startDate)} 至 {day(lease.endDate)}</Text>
              <Text className="card-stat">¥{money(lease.rentAmount)}</Text>
            </View>
            <View className="detail-row">
              <Text className="text-muted">押金 ¥{money(lease.depositAmount)}</Text>
              <Text className="text-muted">{lease.autoRenew ? '自动续约' : '不自动续约'}</Text>
            </View>
            {lease.status !== 'ACTIVE' ? (
              <Text className="text-muted">
                {lease.terminationReason ||
                  (lease.terminationType === 'EXPIRED'
                    ? '到期解约'
                    : lease.terminationType === 'BREACH'
                      ? '违约退租'
                      : '协商解约')}
              </Text>
            ) : null}
          </View>
        ))}
      </Card>
    </View>
  );
}
