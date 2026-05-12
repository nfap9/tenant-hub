import { useState, useMemo, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { useAppSession } from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { Button, Card, EmptyState, Badge } from '../../components/ui';
import { NoOrganization } from '../../components/NoOrganization';
import { money, compactMoney, isThisMonth, daysUntil, monthlyAmount } from '../../utils/format';
import type { Apartment, Room, Lease, MonthlyBill, Bill } from '../../types/domain';
import './index.scss';

const statusPriority: Record<MonthlyBill["status"], number> = {
  UNPAID: 0,
  PARTIAL_PAID: 0,
  BILLING: 1,
  FAILED: 2,
  DRAFT: 2,
  PAID: 3,
  VOID: 4
};

const sortMonthlyBillsForList = (bills: MonthlyBill[]) =>
  [...bills].sort((left, right) => {
    const priorityDiff = statusPriority[left.status] - statusPriority[right.status];
    if (priorityDiff !== 0) return priorityDiff;
    const dueDateDiff = new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
    if (dueDateDiff !== 0) return dueDateDiff;
    return new Date(right.billingDate).getTime() - new Date(left.billingDate).getTime();
  });

const activeLeaseOf = (room: Room) => room.leases?.find((lease) => lease.status === "ACTIVE");
const leaseMonthlyIncome = (lease: Lease) => {
  const rent = monthlyAmount(lease.rentAmount, lease.cycle);
  const fees = (lease.fees ?? []).reduce((sum, fee) => sum + monthlyAmount(fee.amount, lease.cycle), 0);
  return rent + fees;
};
const isUnpaid = (bill: MonthlyBill) => bill.status !== "PAID" && bill.status !== "VOID";
const isOverdue = (bill: MonthlyBill) => isUnpaid(bill) && bill.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10);

type TodoItem = {
  key: string;
  title: string;
  detail: string;
  badge: string;
  tone: "danger" | "warning" | "calm";
};

export default function Index() {
  const { currentOrgId, session } = useAppSession();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [monthlyBills, setMonthlyBills] = useState<MonthlyBill[]>([]);
  const [reviewBills, setReviewBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOrgId || !session?.token) return;
    setLoading(true);
    try {
      const [nextApartments, nextRooms, nextMonthlyBills, failedBills, billingBills] = await Promise.all([
        apiClient<Apartment[]>("/apartments", { organizationId: currentOrgId }),
        apiClient<Room[]>("/apartments/rooms", { organizationId: currentOrgId }),
        apiClient<MonthlyBill[]>("/bills/monthly", { organizationId: currentOrgId }),
        apiClient<Bill[]>("/bills?status=FAILED", { organizationId: currentOrgId }),
        apiClient<Bill[]>("/bills?status=BILLING", { organizationId: currentOrgId })
      ]);
      setApartments(nextApartments);
      setRooms(nextRooms);
      setMonthlyBills(nextMonthlyBills);
      setReviewBills([...failedBills, ...billingBills].filter((bill) => bill.mode === "POSTPAID"));
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "首页数据加载失败", icon: "none" });
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

  const activeLeases = useMemo(() => rooms.flatMap((room) => room.leases ?? []).filter((lease) => lease.status === "ACTIVE"), [rooms]);
  const occupiedCount = rooms.filter((room) => room.status === "OCCUPIED").length;
  const vacantCount = rooms.filter((room) => room.status === "VACANT").length;
  const occupancyRate = rooms.length ? Math.round((occupiedCount / rooms.length) * 100) : 0;
  const monthlyIncome = activeLeases.reduce((sum, lease) => sum + leaseMonthlyIncome(lease), 0);
  const thisMonthExpense = apartments
    .flatMap((apartment) => apartment.expenses ?? [])
    .filter((expense) => isThisMonth(expense.spentAt))
    .reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const unpaidTotal = monthlyBills.filter(isUnpaid).reduce((sum, bill) => sum + Number(bill.totalAmount) - Number(bill.paidAmount), 0);
  const paidThisMonth = monthlyBills
    .filter((bill) => isThisMonth(bill.billingDate))
    .reduce((sum, bill) => sum + Number(bill.paidAmount ?? 0), 0);
  const overdueBills = monthlyBills.filter(isOverdue);
  const expiringLeases = activeLeases
    .map((lease) => ({ lease, remainingDays: daysUntil(lease.endDate) }))
    .filter((item) => item.remainingDays >= 0 && item.remainingDays <= 30)
    .sort((left, right) => left.remainingDays - right.remainingDays);
  const topApartments = apartments
    .map((apartment) => {
      const apartmentRooms = apartment.rooms ?? [];
      const apartmentOccupied = apartmentRooms.filter((room) => room.status === "OCCUPIED").length;
      const apartmentIncome = apartmentRooms.reduce((sum, room) => {
        const lease = activeLeaseOf(room);
        return lease ? sum + leaseMonthlyIncome(lease) : sum;
      }, 0);
      return { apartment, apartmentRooms, apartmentOccupied, apartmentIncome };
    })
    .sort((left, right) => right.apartmentIncome - left.apartmentIncome)
    .slice(0, 3);

  const todos: TodoItem[] = [
    overdueBills.length
      ? {
          key: "overdue",
          title: "逾期账单",
          detail: `${overdueBills.length} 张账单已过应收日，剩余待收 ¥${compactMoney(overdueBills.reduce((sum, bill) => sum + Number(bill.totalAmount) - Number(bill.paidAmount), 0))}`,
          badge: "收款",
          tone: "danger"
        }
      : undefined,
    reviewBills.length
      ? {
          key: "review",
          title: "后付费出账处理",
          detail: `${reviewBills.length} 张水电账单需要补读数或重新出账`,
          badge: "出账",
          tone: "warning"
        }
      : undefined,
    expiringLeases.length
      ? {
          key: "lease",
          title: "租约即将到期",
          detail: `${expiringLeases[0].lease.tenantName} ${expiringLeases[0].remainingDays} 天后到期，共 ${expiringLeases.length} 份需跟进`,
          badge: "续租",
          tone: "warning"
        }
      : undefined,
    vacantCount
      ? {
          key: "vacant",
          title: "空房可出租",
          detail: `${vacantCount} 间空房可继续签约，当前出租率 ${occupancyRate}%`,
          badge: "招租",
          tone: "calm"
        }
      : undefined
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
            <Text className="home-hero-value">¥{compactMoney(monthlyIncome)}</Text>
          </View>
          <Button variant="secondary" size="small" loading={loading} disabled={loading} onClick={loadData}>
            {loading ? "刷新中" : "刷新"}
          </Button>
        </View>
        <View className="home-hero-grid">
          <View className="home-hero-cell">
            <Text className="home-hero-label">已收</Text>
            <Text className="home-hero-metric">¥{compactMoney(paidThisMonth)}</Text>
          </View>
          <View className="home-hero-cell">
            <Text className="home-hero-label">待收</Text>
            <Text className="home-hero-metric">¥{compactMoney(unpaidTotal)}</Text>
          </View>
          <View className="home-hero-cell">
            <Text className="home-hero-label">支出</Text>
            <Text className="home-hero-metric">¥{compactMoney(thisMonthExpense)}</Text>
          </View>
        </View>
      </View>

      <View className="stat-row">
        <Card className="stat-card">
          <Text className="stat-label">公寓</Text>
          <Text className="stat-value">{apartments.length}</Text>
        </Card>
        <Card className="stat-card">
          <Text className="stat-label">房间</Text>
          <Text className="stat-value">{rooms.length}</Text>
        </Card>
        <Card className="stat-card">
          <Text className="stat-label">出租率</Text>
          <Text className="stat-value">{occupancyRate}%</Text>
        </Card>
      </View>

      <Card title="常用操作" subtitle="快速进入高频功能">
        <View className="quick-action-grid">
          <View className="quick-action-card" onClick={() => Taro.switchTab({ url: '/pages/bills/index' })}>
            <View className="quick-action-icon">💰</View>
            <Text className="quick-action-label">登记收款</Text>
          </View>
          <View className="quick-action-card" onClick={() => Taro.switchTab({ url: '/pages/rooms/index' })}>
            <View className="quick-action-icon">📝</View>
            <Text className="quick-action-label">签约入住</Text>
          </View>
          <View className="quick-action-card" onClick={() => Taro.switchTab({ url: '/pages/bills/index' })}>
            <View className="quick-action-icon">⚡</View>
            <Text className="quick-action-label">抄表录入</Text>
          </View>
        </View>
      </Card>

      <Card title="资产出租" subtitle={`${occupiedCount} 已租 · ${vacantCount} 空闲`}>
        {topApartments.length === 0 ? (
          <EmptyState emoji="🏢" title="暂无公寓资产" subtitle="请先到公寓页添加" />
        ) : null}
        {topApartments.map(({ apartment, apartmentRooms, apartmentOccupied, apartmentIncome }) => (
          <View key={apartment.id} className="home-apartment-row">
            <View className="home-apartment-main">
              <Text className="card-title">{apartment.name}</Text>
              <Text className="text-muted">{apartment.location}</Text>
            </View>
            <View className="home-apartment-stat">
              <Text className="card-stat">¥{compactMoney(apartmentIncome)}</Text>
              <Text className="stat-label">{apartmentOccupied}/{apartmentRooms.length} 间</Text>
            </View>
          </View>
        ))}
      </Card>

      <Card title="待办事项" subtitle={`${todos.length} 项`}>
        {todos.length === 0 ? (
          <EmptyState emoji="✅" title="暂无紧急待办" subtitle="经营状态稳定" />
        ) : null}
        {todos.map((todo) => (
          <View key={todo.key} className="todo-item">
            <View className="todo-content">
              <Text className="card-title">{todo.title}</Text>
              <Text className="text-muted">{todo.detail}</Text>
            </View>
            <Badge tone={todo.tone === "danger" ? "danger" : todo.tone === "warning" ? "warning" : "primary"}>{todo.badge}</Badge>
          </View>
        ))}
      </Card>
    </View>
  );
}
