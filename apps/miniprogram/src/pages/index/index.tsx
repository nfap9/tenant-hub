import { useState, useMemo, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { useAppSession } from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { Button, Card, EmptyState, Badge, Icon } from '../../components/ui';
import { NoOrganization } from '../../components/NoOrganization';
import {
  compactMoney,
  isThisMonth,
  daysUntil,
  monthlyAmount,
} from '../../utils/format';
import type { Apartment, Room, Lease, Bill } from '../../types/domain';
import './index.scss';

const leaseMonthlyIncome = (lease: Lease) => {
  const rent = monthlyAmount(lease.rentAmount, lease.cycle);
  const fees = (lease.fees ?? []).reduce(
    (sum, fee) => sum + monthlyAmount(fee.amount, lease.cycle),
    0
  );
  return rent + fees;
};
import { groupBills, type BillGroup } from '../bills/utils';

const isUnpaid = (group: BillGroup) =>
  group.status !== 'PAID' && group.status !== 'VOID';
const isOverdue = (group: BillGroup) =>
  isUnpaid(group) &&
  group.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10);

type TodoItem = {
  key: string;
  title: string;
  detail: string;
  badge: string;
  tone: 'danger' | 'warning' | 'calm';
};

export default function Index() {
  const { currentOrgId, session } = useAppSession();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [billGroups, setBillGroups] = useState<BillGroup[]>([]);
  const [reviewBills, setReviewBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOrgId || !session?.token) return;
    setLoading(true);
    try {
      const [nextApartments, nextRooms, allBills, failedBills, billingBills] =
        await Promise.all([
          apiClient<Apartment[]>('/apartments', {
            organizationId: currentOrgId,
          }),
          apiClient<Room[]>('/apartments/rooms', {
            organizationId: currentOrgId,
          }),
          apiClient<Bill[]>('/bills', {
            organizationId: currentOrgId,
          }),
          apiClient<Bill[]>('/bills?status=FAILED', {
            organizationId: currentOrgId,
          }),
          apiClient<Bill[]>('/bills?status=BILLING', {
            organizationId: currentOrgId,
          }),
        ]);
      setApartments(nextApartments);
      setRooms(nextRooms);
      setBillGroups(groupBills(allBills));
      setReviewBills(
        [...failedBills, ...billingBills].filter(
          (bill) => bill.mode === 'POSTPAID'
        )
      );
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '首页数据加载失败',
        icon: 'none',
      });
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, session]);

  useDidShow(() => {
    loadData();
  });

  usePullDownRefresh(() => {
    loadData().finally(() => Taro.stopPullDownRefresh());
  });

  const activeLeases = useMemo(
    () =>
      rooms
        .flatMap((room) => room.leases ?? [])
        .filter((lease) => lease.status === 'ACTIVE'),
    [rooms]
  );
  const occupiedCount = rooms.filter(
    (room) => room.status === 'OCCUPIED'
  ).length;
  const vacantCount = rooms.filter((room) => room.status === 'VACANT').length;
  const occupancyRate = rooms.length
    ? Math.round((occupiedCount / rooms.length) * 100)
    : 0;
  const vacantLayoutStats = useMemo(() => {
    const layoutCounts = rooms
      .filter((room) => room.status === 'VACANT')
      .reduce<Record<string, number>>((counts, room) => {
        const layout = room.layout.trim() || '未配置';
        counts[layout] = (counts[layout] ?? 0) + 1;
        return counts;
      }, {});

    return Object.entries(layoutCounts).sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
    );
  }, [rooms]);
  const monthlyIncome = activeLeases.reduce(
    (sum, lease) => sum + leaseMonthlyIncome(lease),
    0
  );
  const thisMonthExpense = apartments
    .flatMap((apartment) => apartment.expenses ?? [])
    .filter((expense) => isThisMonth(expense.spentAt))
    .reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const unpaidTotal = billGroups
    .filter(isUnpaid)
    .reduce((sum, group) => sum + group.totalAmount - group.paidAmount, 0);
  const paidThisMonth = billGroups
    .filter((group) => isThisMonth(group.billingDate))
    .reduce((sum, group) => sum + group.paidAmount, 0);
  const overdueBills = billGroups.filter(isOverdue);
  const expiringLeases = activeLeases
    .map((lease) => ({ lease, remainingDays: daysUntil(lease.endDate) }))
    .filter((item) => item.remainingDays >= 0 && item.remainingDays <= 30)
    .sort((left, right) => left.remainingDays - right.remainingDays);
  const todos: TodoItem[] = [
    overdueBills.length
      ? {
          key: 'overdue',
          title: '逾期账单',
          detail: `${overdueBills.length} 张账单已过应收日，剩余待收 ¥${compactMoney(overdueBills.reduce((sum, group) => sum + group.totalAmount - group.paidAmount, 0))}`,
          badge: '收款',
          tone: 'danger',
        }
      : undefined,
    reviewBills.length
      ? {
          key: 'review',
          title: '后付费出账处理',
          detail: `${reviewBills.length} 张水电账单需要补读数或重新出账`,
          badge: '出账',
          tone: 'warning',
        }
      : undefined,
    expiringLeases.length
      ? {
          key: 'lease',
          title: '租约即将到期',
          detail: `${expiringLeases[0].lease.tenantName} ${expiringLeases[0].remainingDays} 天后到期，共 ${expiringLeases.length} 份需跟进`,
          badge: '续租',
          tone: 'warning',
        }
      : undefined,
    vacantCount
      ? {
          key: 'vacant',
          title: '空房可出租',
          detail: `${vacantCount} 间空房可继续签约，当前出租率 ${occupancyRate}%`,
          badge: '招租',
          tone: 'calm',
        }
      : undefined,
  ].filter(Boolean) as TodoItem[];

  if (!currentOrgId) {
    return <NoOrganization />;
  }

  return (
    <View className="page-container">
      <View className="home-hero">
        <View className="home-hero-header">
          <View>
            <Text className="home-eyebrow">本月经营概览</Text>
            <Text className="home-hero-value">
              ¥{compactMoney(monthlyIncome)}
            </Text>
          </View>
          <Button
            variant="secondary"
            size="small"
            loading={loading}
            disabled={loading}
            onClick={loadData}
          >
            {loading ? '刷新中' : '刷新'}
          </Button>
        </View>
        <View className="home-hero-grid">
          <View className="home-hero-cell">
            <Text className="home-hero-label">已收</Text>
            <Text className="home-hero-metric">
              ¥{compactMoney(paidThisMonth)}
            </Text>
          </View>
          <View className="home-hero-cell">
            <Text className="home-hero-label">待收</Text>
            <Text className="home-hero-metric">
              ¥{compactMoney(unpaidTotal)}
            </Text>
          </View>
          <View className="home-hero-cell">
            <Text className="home-hero-label">支出</Text>
            <Text className="home-hero-metric">
              ¥{compactMoney(thisMonthExpense)}
            </Text>
          </View>
        </View>
      </View>

      <Card className="occupancy-summary">
        <View className="occupancy-metrics">
          <View className="occupancy-metric occupancy-metric--vacant">
            <Text className="stat-label">空闲房间</Text>
            <Text className="stat-value">{vacantCount}</Text>
          </View>
          <View className="occupancy-divider" />
          <View className="occupancy-metric">
            <Text className="stat-label">已租房间</Text>
            <Text className="stat-value">{occupiedCount}</Text>
          </View>
        </View>
        <View className="vacant-layouts">
          <Text className="vacant-layouts-title">空闲户型</Text>
          {vacantLayoutStats.length === 0 ? (
            <Text className="vacant-layouts-empty">暂无空闲房间</Text>
          ) : (
            <View className="vacant-layout-chip-row">
              {vacantLayoutStats.map(([layout, count]) => (
                <View key={layout} className="vacant-layout-chip">
                  <Text className="vacant-layout-name">{layout}</Text>
                  <Text className="vacant-layout-count">{count} 间</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Card>

      <View className="quick-action-row">
        <View
          className="quick-action-button"
          onClick={() => Taro.switchTab({ url: '/pages/bills/index' })}
        >
          <View className="quick-action-icon">
            <Icon name="payment" size="md" />
          </View>
          <Text className="quick-action-label">登记收款</Text>
        </View>
        <View
          className="quick-action-button"
          onClick={() => Taro.switchTab({ url: '/pages/rooms/index' })}
        >
          <View className="quick-action-icon">
            <Icon name="contract" size="md" />
          </View>
          <Text className="quick-action-label">签约入住</Text>
        </View>
        <View
          className="quick-action-button"
          onClick={() => Taro.switchTab({ url: '/pages/bills/index' })}
        >
          <View className="quick-action-icon">
            <Icon name="meter" size="md" />
          </View>
          <Text className="quick-action-label">抄表录入</Text>
        </View>
      </View>

      <Card title="待办事项" subtitle={`${todos.length} 项`}>
        {todos.length === 0 ? (
          <EmptyState
            icon="check"
            title="暂无紧急待办"
            subtitle="经营状态稳定"
          />
        ) : null}
        {todos.map((todo) => (
          <View key={todo.key} className="todo-item">
            <View className="todo-content">
              <Text className="card-title">{todo.title}</Text>
              <Text className="text-muted">{todo.detail}</Text>
            </View>
            <Badge
              tone={
                todo.tone === 'danger'
                  ? 'danger'
                  : todo.tone === 'warning'
                    ? 'warning'
                    : 'primary'
              }
            >
              {todo.badge}
            </Badge>
          </View>
        ))}
      </Card>
    </View>
  );
}
