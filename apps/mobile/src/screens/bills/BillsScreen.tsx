import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { DateField } from '../../components/DateField';
import { RoomBillSelector, type SelectorRoom } from '../../components/RoomBillSelector';
import { TaskSheet } from '../../components/TaskSheet';
import { Badge, Button, Card, EmptyState, Input } from '../../components/ui';
import type { BillActionKey, BillTabKey } from '../../navigation/homeQuickActions';
import { mobileApi, mobileText } from '../../services';
import { styles } from '../../theme/styles';
import type { Bill, BillStatus, MeterType, MonthlyBill, Room } from '../../types';
import { getPaymentAmountError } from './billPayment';
import { getMonthlyBillCardSummary, sortMonthlyBillsForList } from './billPresentation';

type Props = {
  token: string;
  organizationId?: string;
  setNotice: (notice: string) => void;
  initialTab?: BillTabKey;
  initialAction?: BillActionKey;
  tabRequestKey?: number;
};

type BillLayer =
  | 'payment'
  | 'reading'
  | 'utility'
  | 'utilityImport'
  | 'utilityExport'
  | 'monthlyDetail'
  | 'deleteConfirm'
  | 'deleteChildConfirm'
  | 'editBillItem';

type ReadingForm = {
  roomId: string;
  meterType: MeterType;
  readingDate: string;
  value: string;
  note: string;
};

type PaymentForm = {
  monthlyBillId: string;
  amount: string;
  method: string;
  note: string;
};

type UtilityForm = {
  billId: string;
  previousWater: string;
  currentWater: string;
  previousPower: string;
  currentPower: string;
};

const apiOptions = (organizationId: string, method = 'GET', body?: unknown): RequestInit => ({
  method,
  headers: { 'x-organization-id': organizationId },
  ...(body ? { body: JSON.stringify(body) } : {}),
});

const today = () => new Date().toISOString().slice(0, 10);
const money = (value?: string | number) => Number(value ?? 0).toFixed(2);
const day = (value: string) => value.slice(0, 10);
const meterLabels: Record<MeterType, string> = { WATER: '水表', POWER: '电表' };
const statusLabels: Record<BillStatus, string> = {
  DRAFT: '草稿',
  BILLING: '出账中',
  UNPAID: '待支付',
  PARTIAL_PAID: '部分支付',
  PAID: '已支付',
  FAILED: '出账失败',
  VOID: '已作废',
};

const toneForBillStatus = (status: BillStatus): Parameters<typeof Badge>[0]['tone'] => {
  if (status === 'PAID') return 'success';
  if (status === 'FAILED' || status === 'VOID') return 'danger';
  if (status === 'BILLING') return 'neutral';
  return 'warning';
};

const billModeText = (bill: Bill) => (bill.mode === 'PREPAID' ? '预付' : '后付');
const remainingAmount = (bill: MonthlyBill) => Number(bill.totalAmount) - Number(bill.paidAmount);
const roomKeyForBill = (bill: MonthlyBill) =>
  bill.lease?.roomId ?? bill.lease?.room?.id ?? bill.lease?.room?.roomNo ?? bill.id;

const tabConfig: Array<{ key: BillTabKey; label: string }> = [
  { key: 'unpaid', label: '待支付' },
  { key: 'pending', label: '待处理' },
  { key: 'all', label: '全部' },
];

export default function BillsScreen({
  token,
  organizationId,
  setNotice,
  initialTab = 'unpaid',
  initialAction,
  tabRequestKey = 0,
}: Props) {
  const [tab, setTab] = useState<BillTabKey>(initialTab);
  const [monthlyBills, setMonthlyBills] = useState<MonthlyBill[]>([]);
  const [reviewBills, setReviewBills] = useState<Bill[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pendingAction, setPendingAction] = useState<BillActionKey>();
  const [activeLayer, setActiveLayer] = useState<BillLayer>();
  const [selectedMonthlyBillId, setSelectedMonthlyBillId] = useState('');
  const [selectedChildBillId, setSelectedChildBillId] = useState('');
  const [editingBillItem, setEditingBillItem] = useState<{
    id: string;
    billId: string;
    name: string;
    amount: string;
    note: string;
  }>();
  const [paymentRoomId, setPaymentRoomId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BillStatus | ''>('');
  const [readingForm, setReadingForm] = useState<ReadingForm>({
    roomId: '',
    meterType: 'WATER',
    readingDate: today(),
    value: '',
    note: '',
  });
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    monthlyBillId: '',
    amount: '',
    method: '线下收款',
    note: '',
  });
  const [utilityForm, setUtilityForm] = useState<UtilityForm>({
    billId: '',
    previousWater: '',
    currentWater: '',
    previousPower: '',
    currentPower: '',
  });
  const [utilityCsv, setUtilityCsv] = useState('');

  const unpaidMonthlyBills = useMemo(
    () => monthlyBills.filter(bill => bill.status === 'UNPAID' || bill.status === 'PARTIAL_PAID'),
    [monthlyBills],
  );
  const unpaidTotal = useMemo(
    () => unpaidMonthlyBills.reduce((sum, bill) => sum + remainingAmount(bill), 0),
    [unpaidMonthlyBills],
  );
  const selectedMonthlyBill = useMemo(
    () => monthlyBills.find(bill => bill.id === selectedMonthlyBillId),
    [monthlyBills, selectedMonthlyBillId],
  );
  const roomById = useMemo(() => new Map(rooms.map(room => [room.id, room])), [rooms]);
  const paymentBills = useMemo(
    () => sortMonthlyBillsForList(unpaidMonthlyBills),
    [unpaidMonthlyBills],
  );
  const selectedPaymentBill = useMemo(
    () => monthlyBills.find(bill => bill.id === paymentForm.monthlyBillId),
    [monthlyBills, paymentForm.monthlyBillId],
  );
  const selectorRooms = useMemo<SelectorRoom[]>(
    () =>
      rooms.map(room => ({
        id: room.id,
        apartmentName: room.apartment?.name ?? '未关联公寓',
        roomNo: room.roomNo,
      })),
    [rooms],
  );
  const paymentRoomBills = useMemo(
    () => paymentBills.filter(bill => roomKeyForBill(bill) === paymentRoomId),
    [paymentBills, paymentRoomId],
  );

  const filteredAllBills = useMemo(() => {
    let result = [...monthlyBills];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        bill =>
          bill.tenantName?.toLowerCase().includes(q) ||
          bill.lease?.room?.roomNo?.toLowerCase().includes(q) ||
          bill.lease?.tenantPhone?.includes(q),
      );
    }
    if (statusFilter) {
      result = result.filter(bill => bill.status === statusFilter);
    }
    return sortMonthlyBillsForList(result);
  }, [monthlyBills, searchQuery, statusFilter]);

  const setPaymentBill = (bill: MonthlyBill) => {
    const isPayable = bill.status !== 'PAID' && bill.status !== 'VOID';
    setPaymentForm(old => ({
      ...old,
      monthlyBillId: isPayable ? bill.id : '',
      amount: isPayable ? String(remainingAmount(bill)) : '',
      note: '',
    }));
  };

  const openPayment = () => {
    const firstUnpaid = paymentBills[0];
    if (!firstUnpaid) {
      setPaymentForm(old => ({ ...old, monthlyBillId: '', amount: '' }));
      setNotice('暂无待收账单');
      return;
    }
    setPaymentRoomId(roomKeyForBill(firstUnpaid));
    setPaymentBill(firstUnpaid);
    setActiveLayer('payment');
  };

  const openMonthlyDetail = (bill: MonthlyBill) => {
    setSelectedMonthlyBillId(bill.id);
    setPaymentBill(bill);
    setActiveLayer('monthlyDetail');
  };

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setLoaded(false);
    try {
      const nextMonthlyBills = await mobileApi<MonthlyBill[]>(
        '/bills/monthly',
        token,
        apiOptions(organizationId),
      );
      const [failedBills, billingBills, nextRooms] = await Promise.all([
        mobileApi<Bill[]>('/bills?status=FAILED', token, apiOptions(organizationId)),
        mobileApi<Bill[]>('/bills?status=BILLING', token, apiOptions(organizationId)),
        mobileApi<Room[]>('/apartments/rooms', token, apiOptions(organizationId)),
      ]);
      const postpaidReviewBills = [...failedBills, ...billingBills].filter(
        bill => bill.mode === 'POSTPAID',
      );
      setMonthlyBills(nextMonthlyBills);
      setReviewBills(postpaidReviewBills);
      setRooms(nextRooms);
      setReadingForm(old => ({ ...old, roomId: old.roomId || nextRooms[0]?.id || '' }));
      setPaymentForm(old => ({
        ...old,
        monthlyBillId:
          old.monthlyBillId || nextMonthlyBills.find(bill => bill.status !== 'PAID')?.id || '',
      }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '账单加载失败');
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [organizationId, setNotice, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setTab(initialTab);
    setActiveLayer(undefined);
    setPendingAction(initialAction);
  }, [initialAction, initialTab, tabRequestKey]);

  useEffect(() => {
    if (!loaded || pendingAction !== 'payment') return;
    openPayment();
    setPendingAction(undefined);
  }, [loaded, pendingAction, paymentBills, roomById]);

  const submitReading = async () => {
    if (!organizationId) return;
    if (!readingForm.roomId || !readingForm.value.trim()) return setNotice('请选择房间并填写读数');
    await mobileApi(
      '/bills/meter-readings',
      token,
      apiOptions(organizationId, 'POST', {
        roomId: readingForm.roomId,
        meterType: readingForm.meterType,
        readingDate: readingForm.readingDate,
        value: Number(readingForm.value),
        note: readingForm.note.trim() || undefined,
      }),
    );
    setNotice('抄表记录已保存');
    setReadingForm(old => ({ ...old, value: '', note: '' }));
    setActiveLayer(undefined);
    await loadData();
  };

  const retryBill = async (bill: Bill) => {
    if (!organizationId) return;
    await mobileApi(`/bills/${bill.id}/retry-billing`, token, apiOptions(organizationId, 'POST'));
    setNotice('已重新尝试出账');
    await loadData();
  };

  const submitPayment = async () => {
    if (!organizationId) return;
    if (!paymentForm.monthlyBillId || !paymentForm.amount.trim())
      return setNotice('请选择月度账单并填写收款金额');
    const bill = monthlyBills.find(item => item.id === paymentForm.monthlyBillId);
    if (!bill || bill.status === 'PAID' || bill.status === 'VOID')
      return setNotice('请选择一张未结清账单');
    const amountError = getPaymentAmountError(paymentForm.amount, remainingAmount(bill));
    if (amountError) return setNotice(amountError);
    try {
      await mobileApi(
        `/bills/monthly/${paymentForm.monthlyBillId}/payments`,
        token,
        apiOptions(organizationId, 'POST', {
          amount: Number(paymentForm.amount),
          method: paymentForm.method.trim() || '线下收款',
          note: paymentForm.note.trim() || undefined,
        }),
      );
      setNotice('收款已登记');
      setPaymentForm(old => ({ ...old, monthlyBillId: '', amount: '', note: '' }));
      setActiveLayer(undefined);
      await loadData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '收款失败');
    }
  };

  const openUtilityReading = (bill: Bill) => {
    const water = bill.items?.find(item => item.type === 'WATER');
    const power = bill.items?.find(item => item.type === 'POWER');
    setUtilityForm({
      billId: bill.id,
      previousWater: water?.previousWater ? String(water.previousWater) : '',
      currentWater: water?.currentWater ? String(water.currentWater) : '',
      previousPower: power?.previousPower ? String(power.previousPower) : '',
      currentPower: power?.currentPower ? String(power.currentPower) : '',
    });
    setActiveLayer('utility');
  };

  const submitUtilityReading = async () => {
    if (!organizationId) return;
    if (!utilityForm.billId) return setNotice('请选择水电账单');
    try {
      await mobileApi(
        `/bills/${utilityForm.billId}/utility-reading`,
        token,
        apiOptions(organizationId, 'POST', {
          previousWater: Number(utilityForm.previousWater || 0),
          currentWater: Number(utilityForm.currentWater || 0),
          previousPower: Number(utilityForm.previousPower || 0),
          currentPower: Number(utilityForm.currentPower || 0),
        }),
      );
      setNotice('水电读数已录入');
      setActiveLayer(undefined);
      await loadData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '水电录入失败');
    }
  };

  const exportUtilityCsv = async () => {
    if (!organizationId) return;
    try {
      const csv = await mobileText('/bills/utility/pending-export', token, {
        headers: { 'x-organization-id': organizationId },
      });
      setUtilityCsv(csv);
      setActiveLayer('utilityExport');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '导出失败');
    }
  };

  const importUtilityCsv = async () => {
    if (!organizationId) return;
    if (!utilityCsv.trim()) return setNotice('请粘贴导入内容');
    try {
      await mobileApi(
        '/bills/utility/import',
        token,
        apiOptions(organizationId, 'POST', { csv: utilityCsv }),
      );
      setNotice('水电读数已导入');
      setUtilityCsv('');
      setActiveLayer(undefined);
      await loadData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '导入失败');
    }
  };

  const deleteMonthlyBill = async (id: string) => {
    if (!organizationId) return;
    try {
      await mobileApi(`/bills/monthly/${id}`, token, apiOptions(organizationId, 'DELETE'));
      setNotice('月度账单已删除');
      setActiveLayer(undefined);
      await loadData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '删除失败');
    }
  };

  const deleteChildBill = async (id: string) => {
    if (!organizationId) return;
    try {
      await mobileApi(`/bills/${id}`, token, apiOptions(organizationId, 'DELETE'));
      setNotice('账单已删除');
      setActiveLayer(undefined);
      setSelectedChildBillId('');
      await loadData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '删除失败');
    }
  };

  const updateBillItem = async () => {
    if (!organizationId || !editingBillItem) return;
    try {
      await mobileApi(
        `/bills/${editingBillItem.billId}/items/${editingBillItem.id}`,
        token,
        apiOptions(organizationId, 'PUT', {
          amount: Number(editingBillItem.amount),
          note: editingBillItem.note.trim() || undefined,
        }),
      );
      setNotice('账单项目已更新');
      setEditingBillItem(undefined);
      await loadData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '更新失败');
    }
  };

  if (!organizationId) {
    return (
      <Card>
        <EmptyState icon="🏢" title="尚未选择组织" subtitle="请先从右上角用户菜单中选择一个组织" />
      </Card>
    );
  }

  return (
    <>
      <View style={styles.statRow}>
        {tab === 'unpaid' ? (
          <>
            <Card padding="md" gap={8} style={{ flex: 1 }}>
              <Text style={styles.statLabel}>待支付账单</Text>
              <Text style={styles.statValue}>{unpaidMonthlyBills.length}</Text>
            </Card>
            <Card padding="md" gap={8} style={{ flex: 1 }}>
              <Text style={styles.statLabel}>待收金额</Text>
              <Text style={styles.statValue}>¥{money(unpaidTotal)}</Text>
            </Card>
          </>
        ) : tab === 'pending' ? (
          <Card padding="md" gap={8} style={{ flex: 1 }}>
            <Text style={styles.statLabel}>待处理账单</Text>
            <Text style={styles.statValue}>{reviewBills.length}</Text>
          </Card>
        ) : (
          <>
            <Card padding="md" gap={8} style={{ flex: 1 }}>
              <Text style={styles.statLabel}>全部账单</Text>
              <Text style={styles.statValue}>{monthlyBills.length}</Text>
            </Card>
            <Card padding="md" gap={8} style={{ flex: 1 }}>
              <Text style={styles.statLabel}>待收金额</Text>
              <Text style={styles.statValue}>¥{money(unpaidTotal)}</Text>
            </Card>
          </>
        )}
      </View>

      <View style={styles.segment}>
        {tabConfig.map(({ key, label }) => (
          <View key={key} style={[styles.segmentItem, tab === key && styles.segmentItemActive]}>
            <Text
              style={[styles.segmentText, tab === key && styles.segmentTextActive]}
              onPress={() => setTab(key)}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>

      <Card
        title={tab === 'unpaid' ? '待支付账单' : tab === 'pending' ? '待处理账单' : '全部账单'}
        headerAction={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {tab === 'unpaid' ? (
              <Button variant="secondary" size="small" onPress={openPayment} icon="cash-outline">
                登记收款
              </Button>
            ) : null}
            {tab === 'pending' ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  size="small"
                  onPress={() => setActiveLayer('reading')}
                  icon="create-outline"
                >
                  录入读数
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  onPress={exportUtilityCsv}
                  icon="download-outline"
                >
                  导出
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  onPress={() => setActiveLayer('utilityImport')}
                  icon="cloud-upload-outline"
                >
                  导入
                </Button>
              </View>
            ) : null}
            <Button
              variant="ghost"
              size="small"
              loading={loading}
              disabled={loading}
              onPress={loadData}
              icon="refresh-outline"
            >
              {loading ? '刷新中' : '刷新'}
            </Button>
          </View>
        }
      />

      {tab === 'unpaid' ? (
        <>
          {unpaidMonthlyBills.length === 0 ? (
            <EmptyState icon="📄" title="暂无待支付账单" subtitle="所有账单均已结清或暂无账单" />
          ) : null}
          {sortMonthlyBillsForList(unpaidMonthlyBills).map(bill => {
            const summary = getMonthlyBillCardSummary(bill);
            return (
              <Card
                key={bill.id}
                variant="outline"
                padding="md"
                gap={12}
                onPress={() => openMonthlyDetail(bill)}
              >
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.cardTitle}>{summary.title}</Text>
                    <Text style={styles.muted}>{summary.meta}</Text>
                  </View>
                  <Badge tone={toneForBillStatus(bill.status)}>{statusLabels[bill.status]}</Badge>
                </View>
                <View style={styles.billAmountRow}>
                  <Text style={styles.billAmount}>¥{money(summary.totalAmount)}</Text>
                  <View style={styles.billSummaryAside}>
                    <Text style={styles.muted}>剩余 ¥{money(summary.remainingAmount)}</Text>
                    <Text style={styles.muted}>已收 ¥{money(summary.paidAmount)}</Text>
                  </View>
                </View>
                <View style={styles.billCardFooter}>
                  <Text style={styles.fieldLabel}>{summary.detailCountText}</Text>
                  <Text style={styles.link}>查看详情</Text>
                </View>
              </Card>
            );
          })}
        </>
      ) : null}

      {tab === 'pending' ? (
        <>
          {reviewBills.length === 0 ? (
            <EmptyState icon="📄" title="没有待处理账单" subtitle="暂无出账失败的水电账单" />
          ) : null}
          {reviewBills.map(bill => (
            <Card key={bill.id} variant="outline" padding="md" gap={12}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.cardTitle}>
                    {bill.lease?.tenantName ?? '租客'} · {bill.lease?.room?.roomNo ?? '房间'}
                  </Text>
                  <Text style={styles.muted}>
                    {day(bill.periodStart)} 至 {day(bill.periodEnd)}
                  </Text>
                </View>
                <Badge tone={toneForBillStatus(bill.status)}>{statusLabels[bill.status]}</Badge>
              </View>
              <Text style={styles.smallDangerText}>
                {bill.failureReason ?? '需要补录或修正水电读数'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  variant="secondary"
                  size="small"
                  onPress={() => retryBill(bill)}
                  icon="refresh-outline"
                >
                  重新出账
                </Button>
                <Button size="small" onPress={() => openUtilityReading(bill)} icon="create-outline">
                  录入本期水电
                </Button>
              </View>
            </Card>
          ))}
        </>
      ) : null}

      {tab === 'all' ? (
        <>
          <View style={{ gap: 8 }}>
            <Input
              placeholder="搜索租客姓名、房间号或手机号"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <View style={styles.segment}>
              {(['', 'UNPAID', 'PARTIAL_PAID', 'PAID', 'FAILED', 'VOID'] as const).map(status => (
                <View
                  key={status || 'all'}
                  style={[styles.segmentItem, statusFilter === status && styles.segmentItemActive]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      statusFilter === status && styles.segmentTextActive,
                    ]}
                    onPress={() => setStatusFilter(status)}
                  >
                    {status ? statusLabels[status] : '全部状态'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          {filteredAllBills.length === 0 ? (
            <EmptyState icon="📄" title="未找到账单" subtitle="尝试调整搜索条件或过滤状态" />
          ) : null}
          {filteredAllBills.map(bill => {
            const summary = getMonthlyBillCardSummary(bill);
            return (
              <Card
                key={bill.id}
                variant="outline"
                padding="md"
                gap={12}
                onPress={() => openMonthlyDetail(bill)}
              >
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.cardTitle}>{summary.title}</Text>
                    <Text style={styles.muted}>{summary.meta}</Text>
                  </View>
                  <Badge tone={toneForBillStatus(bill.status)}>{statusLabels[bill.status]}</Badge>
                </View>
                <View style={styles.billAmountRow}>
                  <Text style={styles.billAmount}>¥{money(summary.totalAmount)}</Text>
                  <View style={styles.billSummaryAside}>
                    <Text style={styles.muted}>剩余 ¥{money(summary.remainingAmount)}</Text>
                    <Text style={styles.muted}>已收 ¥{money(summary.paidAmount)}</Text>
                  </View>
                </View>
                <View style={styles.billCardFooter}>
                  <Text style={styles.fieldLabel}>{summary.detailCountText}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    {bill.status !== 'PAID' ? (
                      <Text
                        style={styles.smallDangerText}
                        onPress={() => {
                          setSelectedMonthlyBillId(bill.id);
                          setActiveLayer('deleteConfirm');
                        }}
                      >
                        删除
                      </Text>
                    ) : null}
                    <Text style={styles.link}>查看详情</Text>
                  </View>
                </View>
              </Card>
            );
          })}
        </>
      ) : null}

      <TaskSheet
        visible={activeLayer === 'monthlyDetail' && !!selectedMonthlyBill}
        variant="drawer"
        title="账单详情"
        subtitle={
          selectedMonthlyBill
            ? `${selectedMonthlyBill.tenantName} · ${day(selectedMonthlyBill.billingDate)}`
            : ''
        }
        onClose={() => setActiveLayer(undefined)}
        footer={
          selectedMonthlyBill &&
          selectedMonthlyBill.status !== 'PAID' &&
          selectedMonthlyBill.status !== 'VOID' ? (
            <Button onPress={submitPayment} icon="cash-outline">
              确认收款
            </Button>
          ) : undefined
        }
      >
        {selectedMonthlyBill ? (
          <>
            <View style={styles.detailPanel}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.cardTitle}>
                    {selectedMonthlyBill.lease?.room?.roomNo ?? '房间'} · 到期{' '}
                    {day(selectedMonthlyBill.dueDate)}
                  </Text>
                  <Text style={styles.muted}>
                    应收 ¥{money(selectedMonthlyBill.totalAmount)} · 已收 ¥
                    {money(selectedMonthlyBill.paidAmount)}
                  </Text>
                </View>
                <Badge tone={toneForBillStatus(selectedMonthlyBill.status)}>
                  {statusLabels[selectedMonthlyBill.status]}
                </Badge>
              </View>
            </View>
            {selectedMonthlyBill.status !== 'PAID' && selectedMonthlyBill.status !== 'VOID' ? (
              <View style={styles.billDetailBlock}>
                <Text style={styles.fieldLabel}>登记收款</Text>
                <View style={styles.formGrid}>
                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>金额</Text>
                    <Input
                      keyboardType="numeric"
                      value={paymentForm.amount}
                      onChangeText={value => setPaymentForm(old => ({ ...old, amount: value }))}
                    />
                  </View>
                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>方式</Text>
                    <Input
                      value={paymentForm.method}
                      onChangeText={value => setPaymentForm(old => ({ ...old, method: value }))}
                    />
                  </View>
                </View>
                <Input
                  placeholder="备注"
                  value={paymentForm.note}
                  onChangeText={value => setPaymentForm(old => ({ ...old, note: value }))}
                />
              </View>
            ) : null}
            {(selectedMonthlyBill.bills ?? []).map(child => (
              <View key={child.id} style={styles.billDetailBlock}>
                <View style={styles.billLine}>
                  <Text style={styles.muted}>
                    {billModeText(child)} · {day(child.periodStart)} 至 {day(child.periodEnd)}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <Text style={styles.cardStat}>¥{money(child.totalAmount)}</Text>
                    {child.status !== 'PAID' ? (
                      <Text
                        style={styles.smallDangerText}
                        onPress={() => {
                          setSelectedChildBillId(child.id);
                          setActiveLayer('deleteChildConfirm');
                        }}
                      >
                        删除
                      </Text>
                    ) : null}
                  </View>
                </View>
                {(child.items ?? []).map(item => (
                  <View key={item.id} style={styles.billItemLine}>
                    <Text style={styles.muted}>
                      {item.name}
                      {item.note ? ` · ${item.note}` : ''}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <Text style={styles.muted}>¥{money(item.amount)}</Text>
                      {child.status !== 'PAID' ? (
                        <Text
                          style={styles.smallDangerText}
                          onPress={() =>
                            setEditingBillItem({
                              id: item.id,
                              billId: child.id,
                              name: item.name,
                              amount: String(item.amount),
                              note: item.note ?? '',
                            })
                          }
                        >
                          修改
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
                {child.mode === 'POSTPAID' ? (
                  <Button
                    variant="secondary"
                    size="small"
                    onPress={() => openUtilityReading(child)}
                    icon="create-outline"
                  >
                    录入本期水电
                  </Button>
                ) : null}
              </View>
            ))}
            {(selectedMonthlyBill.payments ?? []).length ? (
              <View style={styles.billDetailBlock}>
                <Text style={styles.fieldLabel}>收款记录</Text>
                {(selectedMonthlyBill.payments ?? []).map(payment => (
                  <View key={payment.id} style={styles.billItemLine}>
                    <Text style={styles.muted}>
                      {day(payment.paidAt)} · {payment.method}
                    </Text>
                    <Text style={styles.cardStat}>¥{money(payment.amount)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.muted}>暂无收款记录</Text>
            )}
          </>
        ) : null}
      </TaskSheet>

      <TaskSheet
        visible={activeLayer === 'payment'}
        variant="drawer"
        title="登记收款"
        subtitle={
          selectedPaymentBill
            ? `${selectedPaymentBill.tenantName} · 剩余 ¥${money(remainingAmount(selectedPaymentBill))}`
            : '选择公寓和房间账单'
        }
        onClose={() => setActiveLayer(undefined)}
        footer={
          <Button onPress={submitPayment} icon="cash-outline">
            确认收款
          </Button>
        }
      >
        <RoomBillSelector
          rooms={selectorRooms}
          selectedRoomId={paymentRoomId}
          onSelectRoom={roomId => {
            setPaymentRoomId(roomId);
            const firstBill = paymentBills.find(bill => roomKeyForBill(bill) === roomId);
            if (firstBill) {
              setPaymentBill(firstBill);
            } else {
              setPaymentForm(old => ({ ...old, monthlyBillId: '', amount: '', note: '' }));
            }
          }}
        />
        <View style={styles.billDetailBlock}>
          <Text style={styles.fieldLabel}>选择收款账单</Text>
          {paymentRoomBills.map(bill => (
            <Card
              key={bill.id}
              variant={paymentForm.monthlyBillId === bill.id ? 'default' : 'outline'}
              padding="sm"
              gap={8}
              onPress={() => setPaymentBill(bill)}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View>
                  <Text style={styles.cardTitle}>{day(bill.billingDate)}</Text>
                  <Text style={styles.muted}>剩余 ¥{money(remainingAmount(bill))}</Text>
                </View>
                <Badge tone={toneForBillStatus(bill.status)}>{statusLabels[bill.status]}</Badge>
              </View>
            </Card>
          ))}
          {paymentRoomId && paymentRoomBills.length === 0 ? (
            <Text style={styles.muted}>该房间暂无待收账单</Text>
          ) : null}
        </View>
        <View style={styles.billDetailBlock}>
          <Text style={styles.fieldLabel}>收款信息</Text>
          <View style={styles.formGrid}>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>金额</Text>
              <Input
                keyboardType="numeric"
                value={paymentForm.amount}
                onChangeText={value => setPaymentForm(old => ({ ...old, amount: value }))}
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>方式</Text>
              <Input
                value={paymentForm.method}
                onChangeText={value => setPaymentForm(old => ({ ...old, method: value }))}
              />
            </View>
          </View>
          <Input
            placeholder="备注"
            value={paymentForm.note}
            onChangeText={value => setPaymentForm(old => ({ ...old, note: value }))}
          />
        </View>
      </TaskSheet>

      <TaskSheet
        visible={activeLayer === 'reading'}
        variant="drawer"
        title="录入读数"
        subtitle="选择房间、水电类型并填写本次读数"
        onClose={() => setActiveLayer(undefined)}
        footer={
          <Button onPress={submitReading} icon="save-outline">
            保存读数
          </Button>
        }
      >
        <View style={styles.formGrid}>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>日期</Text>
            <DateField
              value={readingForm.readingDate}
              onChange={value => setReadingForm(old => ({ ...old, readingDate: value }))}
            />
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>读数</Text>
            <Input
              keyboardType="numeric"
              value={readingForm.value}
              onChangeText={value => setReadingForm(old => ({ ...old, value }))}
            />
          </View>
        </View>
        <View style={styles.segment}>
          {(['WATER', 'POWER'] as MeterType[]).map(meterType => (
            <View
              key={meterType}
              style={[
                styles.segmentItem,
                readingForm.meterType === meterType && styles.segmentItemActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  readingForm.meterType === meterType && styles.segmentTextActive,
                ]}
                onPress={() => setReadingForm(old => ({ ...old, meterType }))}
              >
                {meterLabels[meterType]}
              </Text>
            </View>
          ))}
        </View>
        <RoomBillSelector
          rooms={selectorRooms}
          selectedRoomId={readingForm.roomId}
          onSelectRoom={roomId => setReadingForm(old => ({ ...old, roomId }))}
        />
        <Input
          placeholder="备注"
          value={readingForm.note}
          onChangeText={value => setReadingForm(old => ({ ...old, note: value }))}
        />
      </TaskSheet>

      <TaskSheet
        visible={activeLayer === 'utility'}
        variant="drawer"
        title="录入本期水电"
        subtitle="按账单填写上期和本期读数"
        onClose={() => setActiveLayer(undefined)}
        footer={
          <Button onPress={submitUtilityReading} icon="save-outline">
            保存水电读数
          </Button>
        }
      >
        <View style={styles.formGrid}>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>上月水表</Text>
            <Input
              keyboardType="numeric"
              value={utilityForm.previousWater}
              onChangeText={value => setUtilityForm(old => ({ ...old, previousWater: value }))}
            />
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>本月水表</Text>
            <Input
              keyboardType="numeric"
              value={utilityForm.currentWater}
              onChangeText={value => setUtilityForm(old => ({ ...old, currentWater: value }))}
            />
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>上月电表</Text>
            <Input
              keyboardType="numeric"
              value={utilityForm.previousPower}
              onChangeText={value => setUtilityForm(old => ({ ...old, previousPower: value }))}
            />
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>本月电表</Text>
            <Input
              keyboardType="numeric"
              value={utilityForm.currentPower}
              onChangeText={value => setUtilityForm(old => ({ ...old, currentPower: value }))}
            />
          </View>
        </View>
      </TaskSheet>

      <TaskSheet
        visible={activeLayer === 'utilityImport'}
        variant="drawer"
        title="导入水电读数"
        subtitle="粘贴从导出模板填写后的 CSV 内容"
        onClose={() => setActiveLayer(undefined)}
        footer={
          <Button onPress={importUtilityCsv} icon="checkmark-outline">
            确认导入
          </Button>
        }
      >
        <Input
          multiline
          value={utilityCsv}
          onChangeText={setUtilityCsv}
          placeholder="billId,房间号,租客,交租日,水电周期开始,水电周期结束,上月水表,本月水表,上月电表,本月电表,失败原因"
        />
      </TaskSheet>

      <TaskSheet
        visible={activeLayer === 'utilityExport'}
        variant="drawer"
        title="待录入水电导出"
        subtitle="复制下方 CSV 内容填写后再导入"
        onClose={() => setActiveLayer(undefined)}
      >
        <Input multiline value={utilityCsv} onChangeText={setUtilityCsv} />
      </TaskSheet>

      <TaskSheet
        visible={activeLayer === 'deleteConfirm'}
        variant="drawer"
        title="删除月度账单"
        subtitle="此操作将同时删除该月度账单下的所有子账单及收款记录，不可恢复"
        onClose={() => setActiveLayer(undefined)}
        footer={
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button variant="secondary" onPress={() => setActiveLayer(undefined)}>
              取消
            </Button>
            <Button variant="danger" onPress={() => deleteMonthlyBill(selectedMonthlyBillId)}>
              确认删除
            </Button>
          </View>
        }
      >
        <Text style={styles.muted}>请确认是否删除该账单？</Text>
      </TaskSheet>

      <TaskSheet
        visible={activeLayer === 'deleteChildConfirm'}
        variant="drawer"
        title="删除子账单"
        subtitle="此操作将删除该子账单及其收款记录，不可恢复"
        onClose={() => setActiveLayer(undefined)}
        footer={
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button variant="secondary" onPress={() => setActiveLayer(undefined)}>
              取消
            </Button>
            <Button variant="danger" onPress={() => deleteChildBill(selectedChildBillId)}>
              确认删除
            </Button>
          </View>
        }
      >
        <Text style={styles.muted}>请确认是否删除该子账单？</Text>
      </TaskSheet>

      <TaskSheet
        visible={Boolean(editingBillItem)}
        variant="dialog"
        title={editingBillItem ? `修改 ${editingBillItem.name}` : '修改账单项目'}
        onClose={() => setEditingBillItem(undefined)}
        footer={
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button variant="secondary" onPress={() => setEditingBillItem(undefined)}>
              取消
            </Button>
            <Button onPress={updateBillItem} icon="save-outline">
              保存
            </Button>
          </View>
        }
      >
        <View style={{ gap: 12 }}>
          <View style={styles.formGrid}>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>金额</Text>
              <Input
                keyboardType="numeric"
                value={editingBillItem?.amount}
                onChangeText={value =>
                  setEditingBillItem(old => (old ? { ...old, amount: value } : undefined))
                }
              />
            </View>
          </View>
          <Input
            placeholder="备注（可选）"
            value={editingBillItem?.note}
            onChangeText={value =>
              setEditingBillItem(old => (old ? { ...old, note: value } : undefined))
            }
          />
        </View>
      </TaskSheet>
    </>
  );
}
