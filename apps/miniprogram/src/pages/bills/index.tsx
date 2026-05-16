import { useState, useMemo, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { useAppSession } from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { getApiBaseUrl } from '../../constants/config';
import { Button, Card, EmptyState, Badge, Input, DateField } from '../../components/ui';
import { NoOrganization } from '../../components/NoOrganization';
import { money, day, today } from '../../utils/format';
import type { Bill, BillStatus, MonthlyBill, MeterType, Room } from '../../types/domain';
import './index.scss';

const statusLabels: Record<BillStatus, string> = {
  DRAFT: "草稿",
  BILLING: "出账中",
  UNPAID: "待支付",
  PARTIAL_PAID: "部分支付",
  PAID: "已支付",
  FAILED: "出账失败",
  VOID: "已作废"
};

const toneForBillStatus = (status: BillStatus): "success" | "warning" | "danger" | "neutral" => {
  if (status === "PAID") return "success";
  if (status === "FAILED" || status === "VOID") return "danger";
  if (status === "BILLING") return "neutral";
  return "warning";
};

const billModeText = (bill: Bill) => (bill.mode === "PREPAID" ? "预付" : "后付");
const remainingAmount = (bill: MonthlyBill) => Number(bill.totalAmount) - Number(bill.paidAmount);
const roomKeyForBill = (bill: MonthlyBill) => bill.lease?.roomId ?? bill.lease?.room?.id ?? bill.lease?.room?.roomNo ?? bill.id;

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

const getMonthlyBillCardSummary = (bill: MonthlyBill) => {
  const billCount = bill.bills?.length ?? 0;
  const paymentCount = bill.payments?.length ?? 0;
  return {
    title: `${bill.tenantName} · ${day(bill.billingDate)}`,
    meta: `${bill.lease?.room?.roomNo ?? "房间"} · 到期 ${day(bill.dueDate)}`,
    totalAmount: Number(bill.totalAmount ?? 0),
    paidAmount: Number(bill.paidAmount ?? 0),
    remainingAmount: Number(bill.totalAmount ?? 0) - Number(bill.paidAmount ?? 0),
    detailCountText: `${billCount} 项账单 · ${paymentCount} 笔收款`
  };
};

const getPaymentAmountError = (amountText: string, remaining: number) => {
  if (!amountText.trim()) return "请填写收款金额";
  const amount = Number(amountText);
  if (!Number.isFinite(amount)) return "收款金额必须是有效数字";
  if (amount <= 0) return "收款金额必须大于 0";
  if (amount > remaining) return `收款金额不能超过剩余应收 ¥${money(remaining)}`;
  return undefined;
};

export default function BillsPage() {
  const { currentOrgId } = useAppSession();
  const [tab, setTab] = useState<"unpaid" | "pending" | "all">("unpaid");
  const [monthlyBills, setMonthlyBills] = useState<MonthlyBill[]>([]);
  const [reviewBills, setReviewBills] = useState<Bill[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [layer, setLayer] = useState<"payment" | "reading" | "utility" | "utilityImport" | "utilityExport" | "monthlyDetail" | "deleteConfirm" | "deleteChildConfirm" | "editBillItem" | undefined>();
  const [selectedMonthlyBillId, setSelectedMonthlyBillId] = useState("");
  const [selectedChildBillId, setSelectedChildBillId] = useState("");
  const [paymentRoomId, setPaymentRoomId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BillStatus | "">("");
  const [readingForm, setReadingForm] = useState({ roomId: "", meterType: "WATER" as MeterType, readingDate: today(), value: "", note: "" });
  const [paymentForm, setPaymentForm] = useState({ monthlyBillId: "", amount: "", method: "线下收款", note: "" });
  const [utilityForm, setUtilityForm] = useState({ billId: "", previousWater: "", currentWater: "", previousPower: "", currentPower: "" });
  const [utilityCsv, setUtilityCsv] = useState("");
  const [editingBillItem, setEditingBillItem] = useState<{ id: string; billId: string; name: string; amount: string; note: string } | undefined>();

  const unpaidMonthlyBills = useMemo(() => monthlyBills.filter((bill) => bill.status === "UNPAID" || bill.status === "PARTIAL_PAID"), [monthlyBills]);
  const unpaidTotal = useMemo(() => unpaidMonthlyBills.reduce((sum, bill) => sum + remainingAmount(bill), 0), [unpaidMonthlyBills]);
  const selectedMonthlyBill = useMemo(() => monthlyBills.find((bill) => bill.id === selectedMonthlyBillId), [monthlyBills, selectedMonthlyBillId]);
  const paymentBills = useMemo(() => sortMonthlyBillsForList(unpaidMonthlyBills), [unpaidMonthlyBills]);
  const paymentRoomBills = useMemo(() => paymentBills.filter((bill) => roomKeyForBill(bill) === paymentRoomId), [paymentBills, paymentRoomId]);

  const filteredAllBills = useMemo(() => {
    let result = [...monthlyBills];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((bill) =>
        bill.tenantName?.toLowerCase().includes(q) ||
        bill.lease?.room?.roomNo?.toLowerCase().includes(q) ||
        bill.lease?.tenantPhone?.includes(q)
      );
    }
    if (statusFilter) result = result.filter((bill) => bill.status === statusFilter);
    return sortMonthlyBillsForList(result);
  }, [monthlyBills, searchQuery, statusFilter]);

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const nextMonthlyBills = await apiClient<MonthlyBill[]>("/bills/monthly", { organizationId: currentOrgId });
      const [failedBills, billingBills, nextRooms] = await Promise.all([
        apiClient<Bill[]>("/bills?status=FAILED", { organizationId: currentOrgId }),
        apiClient<Bill[]>("/bills?status=BILLING", { organizationId: currentOrgId }),
        apiClient<Room[]>("/apartments/rooms", { organizationId: currentOrgId })
      ]);
      const postpaidReviewBills = [...failedBills, ...billingBills].filter((bill) => bill.mode === "POSTPAID");
      setMonthlyBills(nextMonthlyBills);
      setReviewBills(postpaidReviewBills);
      setRooms(nextRooms);
      setReadingForm((old) => ({ ...old, roomId: old.roomId || nextRooms[0]?.id || "" }));
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "账单加载失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useDidShow(() => {
    loadData();
  });

  usePullDownRefresh(() => {
    loadData().finally(() => Taro.stopPullDownRefresh());
  });

  const setPaymentBill = (bill: MonthlyBill) => {
    const isPayable = bill.status !== "PAID" && bill.status !== "VOID";
    setPaymentForm({ monthlyBillId: isPayable ? bill.id : "", amount: isPayable ? String(remainingAmount(bill)) : "", method: "线下收款", note: "" });
  };

  const openPayment = () => {
    const firstUnpaid = paymentBills[0];
    if (!firstUnpaid) {
      Taro.showToast({ title: "暂无待收账单", icon: "none" });
      return;
    }
    setPaymentRoomId(roomKeyForBill(firstUnpaid));
    setPaymentBill(firstUnpaid);
    setLayer("payment");
  };

  const openMonthlyDetail = (bill: MonthlyBill) => {
    setSelectedMonthlyBillId(bill.id);
    setPaymentBill(bill);
    setLayer("monthlyDetail");
  };

  const submitReading = async () => {
    if (!currentOrgId) return;
    if (!readingForm.roomId || !readingForm.value.trim()) return Taro.showToast({ title: "请选择房间并填写读数", icon: "none" });
    try {
      await apiClient("/bills/meter-readings", {
        method: "POST",
        body: { roomId: readingForm.roomId, meterType: readingForm.meterType, readingDate: readingForm.readingDate, value: Number(readingForm.value), note: readingForm.note.trim() || undefined },
        organizationId: currentOrgId
      });
      Taro.showToast({ title: "抄表记录已保存", icon: "success" });
      setReadingForm((old) => ({ ...old, value: "", note: "" }));
      setLayer(undefined);
      await loadData();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "保存失败", icon: "none" });
    }
  };

  const retryBill = async (bill: Bill) => {
    if (!currentOrgId) return;
    try {
      await apiClient(`/bills/${bill.id}/retry-billing`, { method: "POST", organizationId: currentOrgId });
      Taro.showToast({ title: "已重新尝试出账", icon: "success" });
      await loadData();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "重试失败", icon: "none" });
    }
  };

  const submitPayment = async () => {
    if (!currentOrgId) return;
    if (!paymentForm.monthlyBillId || !paymentForm.amount.trim()) return Taro.showToast({ title: "请选择月度账单并填写收款金额", icon: "none" });
    const bill = monthlyBills.find((item) => item.id === paymentForm.monthlyBillId);
    if (!bill || bill.status === "PAID" || bill.status === "VOID") return Taro.showToast({ title: "请选择一张未结清账单", icon: "none" });
    const amountError = getPaymentAmountError(paymentForm.amount, remainingAmount(bill));
    if (amountError) return Taro.showToast({ title: amountError, icon: "none" });
    try {
      await apiClient(`/bills/monthly/${paymentForm.monthlyBillId}/payments`, {
        method: "POST",
        body: { amount: Number(paymentForm.amount), method: paymentForm.method.trim() || "线下收款", note: paymentForm.note.trim() || undefined },
        organizationId: currentOrgId
      });
      Taro.showToast({ title: "收款已登记", icon: "success" });
      setPaymentForm({ monthlyBillId: "", amount: "", method: "线下收款", note: "" });
      setLayer(undefined);
      await loadData();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "收款失败", icon: "none" });
    }
  };

  const openUtilityReading = (bill: Bill) => {
    const water = bill.items?.find((item) => item.type === "WATER");
    const power = bill.items?.find((item) => item.type === "POWER");
    setUtilityForm({
      billId: bill.id,
      previousWater: water?.previousWater ? String(water.previousWater) : "",
      currentWater: water?.currentWater ? String(water.currentWater) : "",
      previousPower: power?.previousPower ? String(power.previousPower) : "",
      currentPower: power?.currentPower ? String(power.currentPower) : ""
    });
    setLayer("utility");
  };

  const submitUtilityReading = async () => {
    if (!currentOrgId) return;
    if (!utilityForm.billId) return Taro.showToast({ title: "请选择水电账单", icon: "none" });
    try {
      await apiClient(`/bills/${utilityForm.billId}/utility-reading`, {
        method: "POST",
        body: {
          previousWater: Number(utilityForm.previousWater || 0),
          currentWater: Number(utilityForm.currentWater || 0),
          previousPower: Number(utilityForm.previousPower || 0),
          currentPower: Number(utilityForm.currentPower || 0)
        },
        organizationId: currentOrgId
      });
      Taro.showToast({ title: "水电读数已录入", icon: "success" });
      setLayer(undefined);
      await loadData();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "水电录入失败", icon: "none" });
    }
  };

  const exportUtilityCsv = async () => {
    if (!currentOrgId) return;
    try {
      const res = await Taro.request({
        url: `${getApiBaseUrl()}/bills/utility/pending-export`,
        header: { authorization: `Bearer ${(await import('../../utils/storage')).getSession()?.token}`, "x-organization-id": currentOrgId }
      });
      setUtilityCsv(typeof res.data === "string" ? res.data : "");
      setLayer("utilityExport");
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "导出失败", icon: "none" });
    }
  };

  const importUtilityCsv = async () => {
    if (!currentOrgId) return;
    if (!utilityCsv.trim()) return Taro.showToast({ title: "请粘贴导入内容", icon: "none" });
    try {
      await apiClient("/bills/utility/import", { method: "POST", body: { csv: utilityCsv }, organizationId: currentOrgId });
      Taro.showToast({ title: "水电读数已导入", icon: "success" });
      setUtilityCsv("");
      setLayer(undefined);
      await loadData();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "导入失败", icon: "none" });
    }
  };

  const deleteMonthlyBill = async (id: string) => {
    if (!currentOrgId) return;
    try {
      await apiClient(`/bills/monthly/${id}`, { method: "DELETE", organizationId: currentOrgId });
      Taro.showToast({ title: "月度账单已删除", icon: "success" });
      setLayer(undefined);
      await loadData();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "删除失败", icon: "none" });
    }
  };

  const deleteChildBill = async (id: string) => {
    if (!currentOrgId) return;
    try {
      await apiClient(`/bills/${id}`, { method: "DELETE", organizationId: currentOrgId });
      Taro.showToast({ title: "账单已删除", icon: "success" });
      setLayer(undefined);
      setSelectedChildBillId("");
      await loadData();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "删除失败", icon: "none" });
    }
  };

  const updateBillItem = async () => {
    if (!currentOrgId || !editingBillItem) return;
    try {
      await apiClient(`/bills/${editingBillItem.billId}/items/${editingBillItem.id}`, {
        method: "PUT",
        organizationId: currentOrgId,
        body: { amount: Number(editingBillItem.amount), note: editingBillItem.note.trim() || undefined }
      });
      Taro.showToast({ title: "账单项目已更新", icon: "success" });
      setEditingBillItem(undefined);
      setLayer("monthlyDetail");
      await loadData();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "更新失败", icon: "none" });
    }
  };

  if (!currentOrgId) {
    return <NoOrganization />;
  }

  return (
    <View className="page-container">
      <View className="stat-row">
        {tab === "unpaid" ? (
          <>
            <Card className="stat-card"><Text className="stat-label">待支付账单</Text><Text className="stat-value">{unpaidMonthlyBills.length}</Text></Card>
            <Card className="stat-card"><Text className="stat-label">待收金额</Text><Text className="stat-value">¥{money(unpaidTotal)}</Text></Card>
          </>
        ) : tab === "pending" ? (
          <Card className="stat-card"><Text className="stat-label">待处理账单</Text><Text className="stat-value">{reviewBills.length}</Text></Card>
        ) : (
          <>
            <Card className="stat-card"><Text className="stat-label">全部账单</Text><Text className="stat-value">{monthlyBills.length}</Text></Card>
            <Card className="stat-card"><Text className="stat-label">待收金额</Text><Text className="stat-value">¥{money(unpaidTotal)}</Text></Card>
          </>
        )}
      </View>

      <View className="segment">
        {([{ key: "unpaid", label: "待支付" }, { key: "pending", label: "待处理" }, { key: "all", label: "全部" }] as const).map(({ key, label }) => (
          <View key={key} className={`segment-item ${tab === key ? 'segment-item--active' : ''}`} onClick={() => setTab(key)}>
            <Text className={`segment-text ${tab === key ? 'segment-text--active' : ''}`}>{label}</Text>
          </View>
        ))}
      </View>

      <View className="section-header">
        <View className="action-row-inline">
          {tab === "unpaid" ? <Button variant="secondary" size="small" onClick={openPayment}>登记收款</Button> : null}
          {tab === "pending" ? (
            <>
              <Button size="small" onClick={() => setLayer("reading")}>录入读数</Button>
              <Button variant="secondary" size="small" onClick={exportUtilityCsv}>导出</Button>
              <Button variant="secondary" size="small" onClick={() => setLayer("utilityImport")}>导入</Button>
            </>
          ) : null}
          <Button variant="ghost" size="small" loading={loading} disabled={loading} onClick={loadData}>{loading ? "刷新中" : "刷新"}</Button>
        </View>
      </View>

      {tab === "unpaid" ? (
        <>
          {unpaidMonthlyBills.length === 0 ? <EmptyState icon="bill" title="暂无待支付账单" subtitle="所有账单均已结清或暂无账单" /> : null}
          {sortMonthlyBillsForList(unpaidMonthlyBills).map((bill) => {
            const summary = getMonthlyBillCardSummary(bill);
            return (
              <View key={bill.id} className="bill-card" onClick={() => openMonthlyDetail(bill)}>
                <View className="bill-card-header">
                  <View>
                    <Text className="card-title">{summary.title}</Text>
                    <Text className="text-muted">{summary.meta}</Text>
                  </View>
                  <Badge tone={toneForBillStatus(bill.status)}>{statusLabels[bill.status]}</Badge>
                </View>
                <View className="bill-amount-row">
                  <Text className="bill-amount">¥{money(summary.totalAmount)}</Text>
                  <View className="bill-summary-aside">
                    <Text className="text-muted">剩余 ¥{money(summary.remainingAmount)}</Text>
                    <Text className="text-muted">已收 ¥{money(summary.paidAmount)}</Text>
                  </View>
                </View>
                <View className="bill-footer">
                  <Text className="field-label">{summary.detailCountText}</Text>
                  <Text className="link-text">查看详情</Text>
                </View>
              </View>
            );
          })}
        </>
      ) : null}

      {tab === "pending" ? (
        <>
          {reviewBills.length === 0 ? <EmptyState icon="check" title="没有待处理账单" subtitle="暂无出账失败的水电账单" /> : null}
          {reviewBills.map((bill) => (
            <View key={bill.id} className="bill-card">
              <View className="bill-card-header">
                <View>
                  <Text className="card-title">{bill.lease?.tenantName ?? "租客"} · {bill.lease?.room?.roomNo ?? "房间"}</Text>
                  <Text className="text-muted">{day(bill.periodStart)} 至 {day(bill.periodEnd)}</Text>
                </View>
                <Badge tone={toneForBillStatus(bill.status)}>{statusLabels[bill.status]}</Badge>
              </View>
              <Text className="danger-text">{bill.failureReason ?? "需要补录或修正水电读数"}</Text>
              <View className="action-row-inline">
                <Button variant="secondary" size="small" onClick={() => retryBill(bill)}>重新出账</Button>
                <Button size="small" onClick={() => openUtilityReading(bill)}>录入本期水电</Button>
              </View>
            </View>
          ))}
        </>
      ) : null}

      {tab === "all" ? (
        <>
          <Input label="搜索账单" placeholder="租客姓名、房间号或手机号" value={searchQuery} onChange={setSearchQuery} />
          <View className="segment">
            {(["", "UNPAID", "PARTIAL_PAID", "PAID", "FAILED", "VOID"] as const).map((status) => (
              <View key={status || "all"} className={`segment-item ${statusFilter === status ? 'segment-item--active' : ''}`} onClick={() => setStatusFilter(status)}>
                <Text className={`segment-text ${statusFilter === status ? 'segment-text--active' : ''}`}>{status ? statusLabels[status] : "全部状态"}</Text>
              </View>
            ))}
          </View>
          {filteredAllBills.length === 0 ? <EmptyState icon="bill" title="未找到账单" subtitle="尝试调整搜索条件或过滤状态" /> : null}
          {filteredAllBills.map((bill) => {
            const summary = getMonthlyBillCardSummary(bill);
            return (
              <View key={bill.id} className="bill-card" onClick={() => openMonthlyDetail(bill)}>
                <View className="bill-card-header">
                  <View>
                    <Text className="card-title">{summary.title}</Text>
                    <Text className="text-muted">{summary.meta}</Text>
                  </View>
                  <Badge tone={toneForBillStatus(bill.status)}>{statusLabels[bill.status]}</Badge>
                </View>
                <View className="bill-amount-row">
                  <Text className="bill-amount">¥{money(summary.totalAmount)}</Text>
                  <View className="bill-summary-aside">
                    <Text className="text-muted">剩余 ¥{money(summary.remainingAmount)}</Text>
                    <Text className="text-muted">已收 ¥{money(summary.paidAmount)}</Text>
                  </View>
                </View>
                <View className="bill-footer">
                  <Text className="field-label">{summary.detailCountText}</Text>
                  <View className="action-row-inline">
                    {bill.status !== "PAID" ? <Text className="danger-text" onClick={() => { setSelectedMonthlyBillId(bill.id); setLayer("deleteConfirm"); }}>删除</Text> : null}
                    <Text className="link-text">查看详情</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </>
      ) : null}

      {/* Payment Layer */}
      {layer === "payment" && (
        <View className="form-panel">
          <Card title="登记收款">
            <Text className="field-label">选择房间</Text>
            <View className="segment">
              {rooms.map((room) => (
                <View key={room.id} className={`segment-item ${paymentRoomId === room.id ? 'segment-item--active' : ''}`} onClick={() => {
                  setPaymentRoomId(room.id);
                  const firstBill = paymentBills.find((bill) => roomKeyForBill(bill) === room.id);
                  if (firstBill) setPaymentBill(firstBill);
                  else setPaymentForm({ monthlyBillId: "", amount: "", method: "线下收款", note: "" });
                }}>
                  <Text className={`segment-text ${paymentRoomId === room.id ? 'segment-text--active' : ''}`}>{room.roomNo}</Text>
                </View>
              ))}
            </View>
            <Text className="field-label">选择账单</Text>
            {paymentRoomBills.map((bill) => (
              <View key={bill.id} className={`bill-select-card ${paymentForm.monthlyBillId === bill.id ? 'bill-select-card--active' : ''}`} onClick={() => setPaymentBill(bill)}>
                <Text className="card-title">{day(bill.billingDate)}</Text>
                <Text className="text-muted">剩余 ¥{money(remainingAmount(bill))}</Text>
                <Badge tone={toneForBillStatus(bill.status)}>{statusLabels[bill.status]}</Badge>
              </View>
            ))}
            {paymentRoomId && paymentRoomBills.length === 0 ? <Text className="text-muted">该房间暂无待收账单</Text> : null}
            <Text className="field-label">收款信息</Text>
            <View className="form-grid">
              <Input label="收款金额" placeholder="请输入金额" type="number" value={paymentForm.amount} onChange={(value) => setPaymentForm((old) => ({ ...old, amount: value }))} />
              <Input label="收款方式" placeholder="例如 线下收款" value={paymentForm.method} onChange={(value) => setPaymentForm((old) => ({ ...old, method: value }))} />
            </View>
            <Input label="备注" placeholder="可选" value={paymentForm.note} onChange={(value) => setPaymentForm((old) => ({ ...old, note: value }))} />
            <View className="action-row">
              <Button onClick={submitPayment}>确认收款</Button>
              <Button variant="ghost" onClick={() => setLayer(undefined)}>取消</Button>
            </View>
          </Card>
        </View>
      )}

      {/* Reading Layer */}
      {layer === "reading" && (
        <View className="form-panel">
          <Card title="录入抄表">
            <Text className="field-label">选择房间</Text>
            <View className="segment">
              {rooms.map((room) => (
                <View key={room.id} className={`segment-item ${readingForm.roomId === room.id ? 'segment-item--active' : ''}`} onClick={() => setReadingForm((old) => ({ ...old, roomId: room.id }))}>
                  <Text className={`segment-text ${readingForm.roomId === room.id ? 'segment-text--active' : ''}`}>{room.roomNo}</Text>
                </View>
              ))}
            </View>
            <Text className="field-label">表类型</Text>
            <View className="segment">
              {(["WATER", "POWER"] as MeterType[]).map((type) => (
                <View key={type} className={`segment-item ${readingForm.meterType === type ? 'segment-item--active' : ''}`} onClick={() => setReadingForm((old) => ({ ...old, meterType: type }))}>
                  <Text className={`segment-text ${readingForm.meterType === type ? 'segment-text--active' : ''}`}>{type === "WATER" ? "水表" : "电表"}</Text>
                </View>
              ))}
            </View>
            <View className="form-grid">
              <DateField label="抄表日期" placeholder="选择日期" value={readingForm.readingDate} onChange={(value) => setReadingForm((old) => ({ ...old, readingDate: value }))} />
              <Input label="读数" placeholder="请输入读数" type="number" value={readingForm.value} onChange={(value) => setReadingForm((old) => ({ ...old, value }))} />
            </View>
            <Input label="备注" placeholder="可选" value={readingForm.note} onChange={(value) => setReadingForm((old) => ({ ...old, note: value }))} />
            <View className="action-row">
              <Button onClick={submitReading}>保存读数</Button>
              <Button variant="ghost" onClick={() => setLayer(undefined)}>取消</Button>
            </View>
          </Card>
        </View>
      )}

      {/* Utility Layer */}
      {layer === "utility" && (
        <View className="form-panel">
          <Card title="录入本期水电">
            <View className="form-grid">
              <View>
                <Input label="上期水表" placeholder="请输入读数" type="number" value={utilityForm.previousWater} onChange={(value) => setUtilityForm((old) => ({ ...old, previousWater: value }))} />
              </View>
              <View>
                <Input label="本期水表" placeholder="请输入读数" type="number" value={utilityForm.currentWater} onChange={(value) => setUtilityForm((old) => ({ ...old, currentWater: value }))} />
              </View>
            </View>
            <View className="form-grid">
              <View>
                <Input label="上期电表" placeholder="请输入读数" type="number" value={utilityForm.previousPower} onChange={(value) => setUtilityForm((old) => ({ ...old, previousPower: value }))} />
              </View>
              <View>
                <Input label="本期电表" placeholder="请输入读数" type="number" value={utilityForm.currentPower} onChange={(value) => setUtilityForm((old) => ({ ...old, currentPower: value }))} />
              </View>
            </View>
            <View className="action-row">
              <Button onClick={submitUtilityReading}>保存水电读数</Button>
              <Button variant="ghost" onClick={() => setLayer(undefined)}>取消</Button>
            </View>
          </Card>
        </View>
      )}

      {/* Utility Import Layer */}
      {layer === "utilityImport" && (
        <View className="form-panel">
          <Card title="导入水电读数">
            <Input label="CSV 内容" placeholder="粘贴 CSV 内容" value={utilityCsv} onChange={setUtilityCsv} />
            <View className="action-row">
              <Button onClick={importUtilityCsv}>确认导入</Button>
              <Button variant="ghost" onClick={() => setLayer(undefined)}>取消</Button>
            </View>
          </Card>
        </View>
      )}

      {/* Utility Export Layer */}
      {layer === "utilityExport" && (
        <View className="form-panel">
          <Card title="导出水电读数模板">
            <Text className="text-muted" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{utilityCsv}</Text>
            <View className="action-row">
              <Button variant="secondary" onClick={() => { Taro.setClipboardData({ data: utilityCsv }); }}>复制到剪贴板</Button>
              <Button variant="ghost" onClick={() => setLayer(undefined)}>关闭</Button>
            </View>
          </Card>
        </View>
      )}

      {/* Monthly Detail Layer */}
      {layer === "monthlyDetail" && selectedMonthlyBill && (
        <View className="form-panel">
          <Card title="账单详情" subtitle={`${selectedMonthlyBill.tenantName} · ${day(selectedMonthlyBill.billingDate)}`}>
            <View className="detail-panel">
              <View className="bill-card-header">
                <View>
                  <Text className="card-title">{selectedMonthlyBill.lease?.room?.roomNo ?? "房间"} · 到期 {day(selectedMonthlyBill.dueDate)}</Text>
                  <Text className="text-muted">应收 ¥{money(selectedMonthlyBill.totalAmount)} · 已收 ¥{money(selectedMonthlyBill.paidAmount)}</Text>
                </View>
                <Badge tone={toneForBillStatus(selectedMonthlyBill.status)}>{statusLabels[selectedMonthlyBill.status]}</Badge>
              </View>
            </View>
            {selectedMonthlyBill.status !== "PAID" && selectedMonthlyBill.status !== "VOID" ? (
              <View className="detail-panel">
                <Text className="field-label">登记收款</Text>
                <View className="form-grid">
                  <Input label="收款金额" placeholder="请输入金额" type="number" value={paymentForm.amount} onChange={(value) => setPaymentForm((old) => ({ ...old, amount: value }))} />
                  <Input label="收款方式" placeholder="例如 线下收款" value={paymentForm.method} onChange={(value) => setPaymentForm((old) => ({ ...old, method: value }))} />
                </View>
                <Input label="备注" placeholder="可选" value={paymentForm.note} onChange={(value) => setPaymentForm((old) => ({ ...old, note: value }))} />
                <Button onClick={submitPayment}>确认收款</Button>
              </View>
            ) : null}
            {(selectedMonthlyBill.bills ?? []).map((child) => (
              <View key={child.id} className="detail-panel">
                <View className="detail-row">
                  <Text className="text-muted">{billModeText(child)} · {day(child.periodStart)} 至 {day(child.periodEnd)}</Text>
                  <View className="action-row-inline">
                    <Text className="card-stat">¥{money(child.totalAmount)}</Text>
                    {child.status !== "PAID" ? <Text className="danger-text" onClick={() => { setSelectedChildBillId(child.id); setLayer("deleteChildConfirm"); }}>删除</Text> : null}
                  </View>
                </View>
                {(child.items ?? []).map((item) => (
                  <View key={item.id} className="detail-row">
                    <Text className="text-muted">{item.name}{item.note ? ` · ${item.note}` : ""}</Text>
                    <View className="action-row-inline">
                      <Text className="text-muted">¥{money(item.amount)}</Text>
                      {child.status !== "PAID" ? (
                        <Text
                          className="link-text"
                          onClick={() => {
                            setEditingBillItem({ id: item.id, billId: child.id, name: item.name, amount: String(item.amount), note: item.note ?? "" });
                            setLayer("editBillItem");
                          }}
                        >
                          修改
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
                {child.mode === "POSTPAID" ? <Button variant="secondary" size="small" onClick={() => openUtilityReading(child)}>录入本期水电</Button> : null}
              </View>
            ))}
            {(selectedMonthlyBill.payments ?? []).length ? (
              <View className="detail-panel">
                <Text className="field-label">收款记录</Text>
                {(selectedMonthlyBill.payments ?? []).map((payment) => (
                  <View key={payment.id} className="detail-row">
                    <Text className="text-muted">{day(payment.paidAt)} · {payment.method}</Text>
                    <Text className="card-stat">¥{money(payment.amount)}</Text>
                  </View>
                ))}
              </View>
            ) : <Text className="text-muted">暂无收款记录</Text>}
            <View className="action-row">
              <Button variant="ghost" onClick={() => setLayer(undefined)}>关闭</Button>
            </View>
          </Card>
        </View>
      )}

      {/* Delete Confirm */}
      {layer === "deleteConfirm" && (
        <View className="form-panel">
          <Card title="删除月度账单">
            <Text className="text-muted">删除后不可恢复，是否确认？</Text>
            <View className="action-row">
              <Button variant="danger" size="small" onClick={() => deleteMonthlyBill(selectedMonthlyBillId)}>确认删除</Button>
              <Button variant="ghost" size="small" onClick={() => setLayer(undefined)}>取消</Button>
            </View>
          </Card>
        </View>
      )}

      {/* Delete Child Confirm */}
      {layer === "deleteChildConfirm" && (
        <View className="form-panel">
          <Card title="删除账单">
            <Text className="text-muted">删除后不可恢复，是否确认？</Text>
            <View className="action-row">
              <Button variant="danger" size="small" onClick={() => deleteChildBill(selectedChildBillId)}>确认删除</Button>
              <Button variant="ghost" size="small" onClick={() => setLayer(undefined)}>取消</Button>
            </View>
          </Card>
        </View>
      )}

      {/* Edit Bill Item */}
      {layer === "editBillItem" && editingBillItem && (
        <View className="form-panel">
          <Card title={`修改 ${editingBillItem.name}`}>
            <View style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
              <View>
                <Input
                  label="金额"
                  value={editingBillItem.amount}
                  onChange={(value) => setEditingBillItem((old) => old ? { ...old, amount: value } : undefined)}
                  type="digit"
                  placeholder="输入金额"
                />
              </View>
              <View>
                <Input
                  label="备注"
                  value={editingBillItem.note}
                  onChange={(value) => setEditingBillItem((old) => old ? { ...old, note: value } : undefined)}
                  placeholder="备注（可选）"
                />
              </View>
            </View>
            <View className="action-row">
              <Button variant="secondary" size="small" onClick={() => { setEditingBillItem(undefined); setLayer("monthlyDetail"); }}>取消</Button>
              <Button size="small" onClick={updateBillItem}>保存</Button>
            </View>
          </Card>
        </View>
      )}
    </View>
  );
}
