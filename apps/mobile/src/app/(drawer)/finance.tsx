import React, { useCallback, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import dayjs from 'dayjs';
import { useFocusEffect, useRouter } from 'expo-router';
import { apiClient } from '@/api/client';
import { Badge, Card, Chip, EmptyState, SectionHeader } from '@/ui/components';
import { colors, fontSize, spacing, statusColor } from '@/ui/theme';
import {
  billCategoryLabel,
  billStatusLabel,
  type BillCategory,
  type BillStatus,
} from '@/utils/labels';
import { add, formatMoney, sub } from '@/utils/money';

// GET /api/bills 返回账单列表（含 lease/room、items、payments），只声明用到的字段
type PaymentDto = {
  id: string;
  amount: number | string;
  waiverAmount: number | string;
  method: string;
  paidAt: string;
  note: string | null;
};

type BillDto = {
  id: string;
  billingDate: string;
  dueDate: string;
  status: BillStatus;
  totalAmount: number | string;
  paidAmount: number | string;
  lease: {
    tenantName: string | null;
    room: { roomNo: string; apartmentId: string };
  };
  items: Array<{ id: string; category: BillCategory }>;
  payments: PaymentDto[];
};

type ApartmentDto = { id: string; name: string };

type PaymentRow = PaymentDto & {
  tenantName: string;
  roomLabel: string;
  billMonth: string;
};

const statusFilters: Array<{ key: BillStatus | ''; label: string }> = [
  { key: '', label: '全部' },
  { key: 'UNPAID', label: '待缴' },
  { key: 'PAID', label: '已缴' },
  { key: 'VOID', label: '已作废' },
  { key: 'PENDING', label: '出账中' },
];

export default function FinanceScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'bills' | 'payments'>('bills');
  const [filter, setFilter] = useState<BillStatus | ''>('');
  const [bills, setBills] = useState<BillDto[]>([]);
  const [apartmentNames, setApartmentNames] = useState<Map<string, string>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      // 后端没有单独的收款记录接口，payments 随账单一起返回
      const [billData, apartmentData] = await Promise.all([
        apiClient<BillDto[]>('/bills'),
        apiClient<ApartmentDto[]>('/apartments'),
      ]);
      setBills(billData);
      setApartmentNames(new Map(apartmentData.map((a) => [a.id, a.name])));
    } catch {
      // 请求失败时保留旧数据，由下拉刷新重试
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // 顶部总览：应收合计 / 逾期笔数 / 本月已收
  const receivable = bills
    .filter((b) => b.status === 'UNPAID')
    .reduce((sum, b) => add(sum, sub(b.totalAmount, b.paidAmount)), 0);
  const overdueCount = bills.filter(
    (b) => b.status === 'UNPAID' && dayjs(b.dueDate).isBefore(dayjs(), 'day')
  ).length;
  const payments: PaymentRow[] = bills
    .flatMap((b) =>
      b.payments.map((p) => ({
        ...p,
        tenantName: b.lease.tenantName ?? '-',
        roomLabel: `${apartmentNames.get(b.lease.room.apartmentId) ?? ''} ${
          b.lease.room.roomNo
        }`.trim(),
        billMonth: dayjs(b.billingDate).format('YYYY-MM'),
      }))
    )
    .sort((a, b) => dayjs(b.paidAt).valueOf() - dayjs(a.paidAt).valueOf());
  const monthReceived = payments
    .filter((p) => dayjs(p.paidAt).isSame(dayjs(), 'month'))
    .reduce((sum, p) => add(sum, p.amount), 0);

  const visibleBills = filter
    ? bills.filter((b) => b.status === filter)
    : bills;

  const overview = (
    <Card style={styles.overviewCard}>
      <View style={styles.overviewRow}>
        <View style={styles.overviewItem}>
          <Text style={[styles.overviewValue, { color: colors.warning }]}>
            ¥{formatMoney(receivable)}
          </Text>
          <Text style={styles.overviewLabel}>应收合计</Text>
        </View>
        <View style={styles.overviewItem}>
          <Text
            style={[
              styles.overviewValue,
              overdueCount > 0 && { color: colors.danger },
            ]}
          >
            {overdueCount}
          </Text>
          <Text style={styles.overviewLabel}>逾期笔数</Text>
        </View>
        <View style={styles.overviewItem}>
          <Text style={[styles.overviewValue, { color: colors.success }]}>
            ¥{formatMoney(monthReceived)}
          </Text>
          <Text style={styles.overviewLabel}>
            本月已收（{dayjs().format('M')}月）
          </Text>
        </View>
      </View>
    </Card>
  );

  const aiGuide = (
    <TouchableOpacity
      style={styles.aiGuide}
      onPress={() => router.push('/')}
      activeOpacity={0.7}
    >
      <Text style={styles.aiGuideText}>收款、出账可以让 AI 助手帮你完成 →</Text>
    </TouchableOpacity>
  );

  const renderBill = ({ item }: { item: BillDto }) => {
    const sc = statusColor[item.status];
    const overdue =
      item.status === 'UNPAID' && dayjs(item.dueDate).isBefore(dayjs(), 'day');
    const categories = [
      ...new Set(item.items.map((it) => billCategoryLabel[it.category])),
    ].join(' · ');
    return (
      <Card style={styles.billCard}>
        <View style={styles.rowLine}>
          <Text style={styles.billTitle}>
            {apartmentNames.get(item.lease.room.apartmentId) ?? ''}{' '}
            {item.lease.room.roomNo}
          </Text>
          <View style={styles.badgeRow}>
            {overdue ? (
              <Badge label="逾期" fg={colors.danger} bg={colors.dangerLight} />
            ) : null}
            <Badge label={billStatusLabel[item.status]} fg={sc.fg} bg={sc.bg} />
          </View>
        </View>
        <Text style={styles.billSub}>
          {dayjs(item.billingDate).format('YYYY-MM')} 期
          {categories ? ` · ${categories}` : ''} · 缴期{' '}
          {dayjs(item.dueDate).format('MM-DD')}
        </Text>
        <View style={[styles.rowLine, { marginTop: spacing(2) }]}>
          <Text style={styles.billPaid}>
            已收 ¥{formatMoney(item.paidAmount)}
          </Text>
          <Text
            style={[styles.billAmount, overdue && { color: colors.danger }]}
          >
            ¥{formatMoney(item.totalAmount)}
          </Text>
        </View>
      </Card>
    );
  };

  const renderPayment = ({ item }: { item: PaymentRow }) => (
    <Card style={styles.billCard}>
      <View style={styles.rowLine}>
        <Text style={styles.billTitle}>
          {item.tenantName} · {item.roomLabel}
        </Text>
        <Text style={styles.billAmount}>¥{formatMoney(item.amount)}</Text>
      </View>
      <Text style={styles.billSub}>
        {item.billMonth} 期 · {item.method}
        {Number(item.waiverAmount) > 0
          ? ` · 减免 ¥${formatMoney(item.waiverAmount)}`
          : ''}
        {item.note ? ` · ${item.note}` : ''}
      </Text>
      <Text style={styles.paymentTime}>
        {dayjs(item.paidAt).format('YYYY-MM-DD HH:mm')}
      </Text>
    </Card>
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {overview}
        <View style={styles.filterBar}>
          <Chip
            label="账单"
            active={tab === 'bills'}
            onPress={() => setTab('bills')}
          />
          <Chip
            label="收款记录"
            active={tab === 'payments'}
            onPress={() => setTab('payments')}
          />
        </View>
        {tab === 'bills' ? (
          <View style={styles.filterBar}>
            {statusFilters.map((f) => (
              <Chip
                key={f.key}
                label={f.label}
                active={filter === f.key}
                onPress={() => setFilter(f.key)}
              />
            ))}
          </View>
        ) : null}
      </View>
      {tab === 'bills' ? (
        <FlatList
          style={styles.list}
          data={visibleBills}
          keyExtractor={(it) => it.id}
          renderItem={renderBill}
          contentContainerStyle={styles.content}
          ListHeaderComponent={<SectionHeader title="账单" />}
          ListFooterComponent={visibleBills.length > 0 ? aiGuide : null}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => void load()}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            loading ? null : <EmptyState text="没有符合条件的账单" />
          }
        />
      ) : (
        <FlatList
          style={styles.list}
          data={payments}
          keyExtractor={(it) => it.id}
          renderItem={renderPayment}
          contentContainerStyle={styles.content}
          ListHeaderComponent={<SectionHeader title="收款记录" />}
          ListFooterComponent={payments.length > 0 ? aiGuide : null}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => void load()}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            loading ? null : <EmptyState text="还没有收款记录" />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing(4), paddingBottom: 0 },
  list: { flex: 1 },
  content: { padding: spacing(4), paddingBottom: spacing(8) },
  overviewCard: { marginBottom: spacing(3) },
  overviewRow: { flexDirection: 'row', justifyContent: 'space-between' },
  overviewItem: { alignItems: 'center', flex: 1 },
  overviewValue: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  overviewLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing(1),
  },
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(1),
    marginBottom: spacing(2),
  },
  billCard: { marginBottom: spacing(2) },
  rowLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing(2),
  },
  badgeRow: { flexDirection: 'row', gap: spacing(1) },
  billTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 1,
  },
  billSub: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing(1),
  },
  billPaid: { fontSize: fontSize.sm, color: colors.textTertiary },
  billAmount: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  paymentTime: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: spacing(1),
  },
  aiGuide: { alignItems: 'center', paddingVertical: spacing(3) },
  aiGuideText: { fontSize: fontSize.sm, color: colors.primary },
});
