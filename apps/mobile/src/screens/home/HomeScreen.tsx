import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { homeQuickActions, type HomeNavigationIntent } from "../../navigation/homeQuickActions";
import { mobileApi } from "../../services";
import { styles } from "../../theme/styles";
import type { Apartment, Bill, Lease, MonthlyBill, Room } from "../../types";

type Props = {
  token: string;
  organizationId?: string;
  setNotice: (notice: string) => void;
  onNavigate: (intent: HomeNavigationIntent) => void;
};

type TodoTone = "danger" | "warning" | "calm";

type TodoItem = {
  key: string;
  title: string;
  detail: string;
  badge: string;
  tone: TodoTone;
};

const apiOptions = (organizationId: string, method = "GET", body?: unknown): RequestInit => ({
  method,
  headers: { "x-organization-id": organizationId },
  ...(body ? { body: JSON.stringify(body) } : {})
});

const money = (value?: string | number) => Number(value ?? 0).toFixed(2);
const compactMoney = (value: number) => {
  if (value >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`;
  return money(value);
};
const isThisMonth = (value?: string) => {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
};
const daysUntil = (value: string) => {
  const target = new Date(value.slice(0, 10));
  const today = new Date(new Date().toISOString().slice(0, 10));
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
};
const monthlyAmount = (value: string | number, cycle?: string) => {
  const amount = Number(value ?? 0);
  if (cycle === "QUARTERLY") return amount / 3;
  if (cycle === "YEARLY") return amount / 12;
  return amount;
};
const activeLeaseOf = (room: Room) => room.leases?.find((lease) => lease.status === "ACTIVE");
const leaseMonthlyIncome = (lease: Lease) => {
  const rent = monthlyAmount(lease.rentAmount, lease.cycle);
  const fees = (lease.fees ?? []).reduce((sum, fee) => sum + monthlyAmount(fee.amount, lease.cycle), 0);
  return rent + fees;
};
const isUnpaid = (bill: MonthlyBill) => bill.status !== "PAID" && bill.status !== "VOID";
const isOverdue = (bill: MonthlyBill) => isUnpaid(bill) && bill.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10);
const todoBadgeStyle = (tone: TodoTone) => {
  if (tone === "danger") return styles.todoBadgeDanger;
  if (tone === "warning") return styles.todoBadgeWarning;
  return styles.todoBadge;
};

export default function HomeScreen({ token, organizationId, setNotice, onNavigate }: Props) {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [monthlyBills, setMonthlyBills] = useState<MonthlyBill[]>([]);
  const [reviewBills, setReviewBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const [nextApartments, nextRooms, nextMonthlyBills, failedBills, billingBills] = await Promise.all([
        mobileApi<Apartment[]>("/apartments", token, apiOptions(organizationId)),
        mobileApi<Room[]>("/apartments/rooms", token, apiOptions(organizationId)),
        mobileApi<MonthlyBill[]>("/bills/monthly", token, apiOptions(organizationId)),
        mobileApi<Bill[]>("/bills?status=FAILED", token, apiOptions(organizationId)),
        mobileApi<Bill[]>("/bills?status=BILLING", token, apiOptions(organizationId))
      ]);
      setApartments(nextApartments);
      setRooms(nextRooms);
      setMonthlyBills(nextMonthlyBills);
      setReviewBills([...failedBills, ...billingBills].filter((bill) => bill.mode === "POSTPAID"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "首页数据加载失败");
    } finally {
      setLoading(false);
    }
  }, [organizationId, setNotice, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  if (!organizationId) {
    return (
      <View style={styles.panel}>
        <Text style={styles.muted}>请先选择组织</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.homeHero}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.homeEyebrow}>本月经营概览</Text>
            <Text style={styles.homeHeroValue}>¥{compactMoney(monthlyIncome)}</Text>
          </View>
          <TouchableOpacity style={styles.refreshButton} onPress={loadData} disabled={loading}>
            <Text style={styles.refreshButtonText}>{loading ? "刷新中" : "刷新"}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.homeHeroGrid}>
          <View>
            <Text style={styles.homeHeroLabel}>已收</Text>
            <Text style={styles.homeHeroMetric}>¥{compactMoney(paidThisMonth)}</Text>
          </View>
          <View>
            <Text style={styles.homeHeroLabel}>待收</Text>
            <Text style={styles.homeHeroMetric}>¥{compactMoney(unpaidTotal)}</Text>
          </View>
          <View>
            <Text style={styles.homeHeroLabel}>支出</Text>
            <Text style={styles.homeHeroMetric}>¥{compactMoney(thisMonthExpense)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.statRow}>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>公寓</Text>
          <Text style={styles.statValue}>{apartments.length}</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>房间</Text>
          <Text style={styles.statValue}>{rooms.length}</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>出租率</Text>
          <Text style={styles.statValue}>{occupancyRate}%</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.sectionHeader}>
          <Text style={styles.quickActionTitle}>常用操作</Text>
        </View>
        <View style={styles.quickActionGrid}>
          {homeQuickActions.map((action) => (
            <TouchableOpacity key={action.key} style={styles.quickActionCard} onPress={() => onNavigate(action.intent)}>
              <View style={styles.quickActionIcon}>
                <Text style={styles.quickActionIconText}>{action.icon}</Text>
              </View>
              <Text style={styles.quickActionLabel}>{action.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>资产出租</Text>
          <Text style={styles.cardStat}>{occupiedCount} 已租 · {vacantCount} 空闲</Text>
        </View>
        {topApartments.length === 0 ? <Text style={styles.muted}>暂无公寓资产，请先到公寓页添加</Text> : null}
        {topApartments.map(({ apartment, apartmentRooms, apartmentOccupied, apartmentIncome }) => (
          <View key={apartment.id} style={styles.homeApartmentRow}>
            <View style={styles.homeApartmentMain}>
              <Text style={styles.cardTitle}>{apartment.name}</Text>
              <Text style={styles.muted}>{apartment.location}</Text>
            </View>
            <View style={styles.homeApartmentStat}>
              <Text style={styles.cardStat}>¥{compactMoney(apartmentIncome)}</Text>
              <Text style={styles.statLabel}>{apartmentOccupied}/{apartmentRooms.length} 间</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.panel}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>待办事项</Text>
          <Text style={styles.cardStat}>{todos.length} 项</Text>
        </View>
        {todos.length === 0 ? <Text style={styles.muted}>暂无紧急待办，经营状态稳定</Text> : null}
        {todos.map((todo) => (
          <View key={todo.key} style={styles.todoItem}>
            <View style={styles.todoContent}>
              <Text style={styles.cardTitle}>{todo.title}</Text>
              <Text style={styles.muted}>{todo.detail}</Text>
            </View>
            <Text style={[styles.todoBadge, todoBadgeStyle(todo.tone)]}>{todo.badge}</Text>
          </View>
        ))}
      </View>
    </>
  );
}
