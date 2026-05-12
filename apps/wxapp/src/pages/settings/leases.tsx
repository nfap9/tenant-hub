import { useState, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useAppSession } from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { Card, EmptyState, Badge } from '../../components/ui';
import { money, day } from '../../utils/format';
import type { Lease, LeaseStatus } from '../../types/domain';

const statusLabels: Record<LeaseStatus, string> = {
  ACTIVE: "生效中",
  TERMINATED: "已终止",
  EXPIRED: "已到期"
};

const toneForStatus: Record<LeaseStatus, "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  TERMINATED: "warning",
  EXPIRED: "danger"
};

export default function LeasesPage() {
  const { currentOrgId } = useAppSession();
  const [leases, setLeases] = useState<Lease[]>([]);

  const loadLeases = useCallback(async () => {
    if (!currentOrgId) return;
    try {
      const data = await apiClient<Lease[]>("/leases", { organizationId: currentOrgId });
      setLeases(data);
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "加载失败", icon: "none" });
    }
  }, [currentOrgId]);

  useDidShow(() => {
    loadLeases();
  });

  if (!currentOrgId) {
    return (
      <View className="page-container">
        <Card><EmptyState emoji="🏢" title="尚未选择组织" subtitle="请先从更多页中选择一个组织" /></Card>
      </View>
    );
  }

  return (
    <View className="page-container">
      <Card title="所有租约" subtitle={`共 ${leases.length} 份`}>
        {leases.length === 0 ? <EmptyState emoji="📄" title="暂无租约" subtitle="请到房间页签约入住" /> : null}
        {leases.map((lease) => (
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
              <Text className="text-muted">{lease.autoRenew ? "自动续约" : "不自动续约"}</Text>
            </View>
            {lease.status !== "ACTIVE" ? (
              <Text className="text-muted">{lease.terminationReason || (lease.terminationType === "EXPIRED" ? "到期解约" : lease.terminationType === "BREACH" ? "违约退租" : "协商解约")}</Text>
            ) : null}
          </View>
        ))}
      </Card>
    </View>
  );
}
