import { useState, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { useAppSession } from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { Card, EmptyState, Badge, Button } from '../../components/ui';
import { day, money } from '../../utils/format';
import type { Plan, SubscriptionOverview } from '../../types/domain';

export default function PlanPage() {
  const { currentOrgId } = useAppSession();
  const [overview, setOverview] = useState<SubscriptionOverview | undefined>();
  const [plans, setPlans] = useState<Plan[]>([]);

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    try {
      const [ov, pl] = await Promise.all([
        apiClient<{ subscription?: SubscriptionOverview["subscription"]; usage: SubscriptionOverview["usage"]; extraQuota: SubscriptionOverview["extraQuota"] }>(`/organizations/${currentOrgId}/subscription`, { organizationId: currentOrgId }),
        apiClient<Plan[]>("/organizations/plans")
      ]);
      setOverview(ov);
      setPlans(pl);
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "加载失败", icon: "none" });
    }
  }, [currentOrgId]);

  useDidShow(() => {
    loadData();
  });

  usePullDownRefresh(() => {
    loadData().finally(() => Taro.stopPullDownRefresh());
  });

  const subscribePlan = async (planId: string) => {
    if (!currentOrgId) return;
    try {
      await apiClient(`/organizations/${currentOrgId}/subscriptions`, { method: "POST", body: { planId }, organizationId: currentOrgId });
      Taro.showToast({ title: "订阅成功", icon: "success" });
      await loadData();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "订阅失败", icon: "none" });
    }
  };

  if (!currentOrgId) {
    return (
      <View className="page-container">
        <Card><EmptyState emoji="🏢" title="尚未选择组织" subtitle="请先从更多页中选择一个组织" /></Card>
      </View>
    );
  }

  const subscription = overview?.subscription;
  const usage = overview?.usage;
  const extra = overview?.extraQuota;

  return (
    <View className="page-container">
      <Card title="当前套餐">
        {subscription ? (
          <>
            <View className="detail-row">
              <Text className="text-muted">套餐名称</Text>
              <Text className="card-title">{subscription.plan.name}</Text>
            </View>
            <View className="detail-row">
              <Text className="text-muted">有效期</Text>
              <Text className="text-muted">{day(subscription.startsAt)} 至 {subscription.endsAt ? day(subscription.endsAt) : "永久"}</Text>
            </View>
            <View className="detail-row">
              <Text className="text-muted">状态</Text>
              <Badge tone={subscription.active ? "success" : "danger"}>{subscription.active ? "生效中" : "已过期"}</Badge>
            </View>
          </>
        ) : (
          <EmptyState emoji="📦" title="暂无订阅" subtitle="请选择一个套餐订阅" />
        )}
      </Card>

      <Card title="用量统计">
        <View className="detail-row">
          <Text className="text-muted">公寓</Text>
          <Text className="card-title">{usage?.apartments ?? 0} / {(subscription?.plan.apartmentLimit ?? 0) + (extra?.apartmentQuota ?? 0)}</Text>
        </View>
        <View className="detail-row">
          <Text className="text-muted">成员</Text>
          <Text className="card-title">{usage?.members ?? 0} / {(subscription?.plan.memberLimit ?? 0) + (extra?.memberQuota ?? 0)}</Text>
        </View>
      </Card>

      <Card title="可选套餐">
        {plans.filter((p) => p.enabled).map((plan) => (
          <View key={plan.id} className="plan-card">
            <View className="detail-row">
              <Text className="card-title">{plan.name}</Text>
              <Text className="card-stat">¥{money(plan.price)}</Text>
            </View>
            <Text className="text-muted">公寓 {plan.apartmentLimit} · 房间 {plan.roomLimit} · 成员 {plan.memberLimit}</Text>
            <Button variant="secondary" size="small" onClick={() => subscribePlan(plan.id)}>订阅</Button>
          </View>
        ))}
      </Card>
    </View>
  );
}
