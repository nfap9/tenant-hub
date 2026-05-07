import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { DateField } from "../../components/DateField";
import { RoomBillSelector, type SelectorRoom } from "../../components/RoomBillSelector";
import { TaskSheet } from "../../components/TaskSheet";
import type { BillActionKey, BillTabKey } from "../../navigation/homeQuickActions";
import { mobileApi, mobileText } from "../../services";
import { styles } from "../../theme/styles";
import type { Bill, BillStatus, MeterReading, MeterType, MonthlyBill, Room } from "../../types";
import { getPaymentAmountError } from "./billPayment";
import { getMonthlyBillCardSummary, sortMonthlyBillsForList } from "./billPresentation";

type Props = {
  token: string;
  organizationId?: string;
  setNotice: (notice: string) => void;
  initialTab?: BillTabKey;
  initialAction?: BillActionKey;
  tabRequestKey?: number;
};

type BillLayer = "payment" | "reading" | "utility" | "utilityImport" | "utilityExport" | "monthlyDetail";

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

const apiOptions = (organizationId: string, method = "GET", body?: unknown): RequestInit => ({
  method,
  headers: { "x-organization-id": organizationId },
  ...(body ? { body: JSON.stringify(body) } : {})
});

const today = () => new Date().toISOString().slice(0, 10);
const money = (value?: string | number) => Number(value ?? 0).toFixed(2);
const day = (value: string) => value.slice(0, 10);
const meterLabels: Record<MeterType, string> = { WATER: "水表", POWER: "电表" };
const statusLabels: Record<BillStatus, string> = {
  DRAFT: "草稿",
  BILLING: "出账中",
  UNPAID: "待支付",
  PARTIAL_PAID: "部分支付",
  PAID: "已支付",
  FAILED: "出账失败",
  VOID: "已作废"
};

const statusStyle = (status: BillStatus) => {
  if (status === "PAID") return styles.statusVacant;
  if (status === "FAILED" || status === "VOID") return styles.statusMaintenance;
  if (status === "BILLING") return styles.statusReserved;
  return styles.statusOccupied;
};

const billModeText = (bill: Bill) => (bill.mode === "PREPAID" ? "预付" : "后付");
const remainingAmount = (bill: MonthlyBill) => Number(bill.totalAmount) - Number(bill.paidAmount);
const roomKeyForBill = (bill: MonthlyBill) => bill.lease?.roomId ?? bill.lease?.room?.id ?? bill.lease?.room?.roomNo ?? bill.id;

export default function BillsScreen({ token, organizationId, setNotice, initialTab = "monthly", initialAction, tabRequestKey = 0 }: Props) {
  const [tab, setTab] = useState<BillTabKey>(initialTab);
  const [monthlyBills, setMonthlyBills] = useState<MonthlyBill[]>([]);
  const [reviewBills, setReviewBills] = useState<Bill[]>([]);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pendingAction, setPendingAction] = useState<BillActionKey>();
  const [activeLayer, setActiveLayer] = useState<BillLayer>();
  const [selectedMonthlyBillId, setSelectedMonthlyBillId] = useState("");
  const [paymentRoomId, setPaymentRoomId] = useState("");
  const [readingForm, setReadingForm] = useState<ReadingForm>({ roomId: "", meterType: "WATER", readingDate: today(), value: "", note: "" });
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({ monthlyBillId: "", amount: "", method: "线下收款", note: "" });
  const [utilityForm, setUtilityForm] = useState<UtilityForm>({ billId: "", previousWater: "", currentWater: "", previousPower: "", currentPower: "" });
  const [utilityCsv, setUtilityCsv] = useState("");

  const unpaidTotal = useMemo(
    () => monthlyBills.filter((bill) => bill.status !== "PAID" && bill.status !== "VOID").reduce((sum, bill) => sum + remainingAmount(bill), 0),
    [monthlyBills]
  );
  const selectedMonthlyBill = useMemo(() => monthlyBills.find((bill) => bill.id === selectedMonthlyBillId), [monthlyBills, selectedMonthlyBillId]);
  const unpaidBills = useMemo(() => monthlyBills.filter((bill) => bill.status !== "PAID" && bill.status !== "VOID"), [monthlyBills]);
  const visibleMonthlyBills = useMemo(() => sortMonthlyBillsForList(monthlyBills), [monthlyBills]);
  const roomById = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [rooms]);
  const paymentBills = useMemo(() => sortMonthlyBillsForList(unpaidBills), [unpaidBills]);
  const selectedPaymentBill = useMemo(() => monthlyBills.find((bill) => bill.id === paymentForm.monthlyBillId), [monthlyBills, paymentForm.monthlyBillId]);
  const selectorRooms = useMemo<SelectorRoom[]>(
    () => rooms.map((room) => ({ id: room.id, apartmentName: room.apartment?.name ?? "未关联公寓", roomNo: room.roomNo })),
    [rooms]
  );
  const paymentRoomBills = useMemo(() => paymentBills.filter((bill) => roomKeyForBill(bill) === paymentRoomId), [paymentBills, paymentRoomId]);

  const setPaymentBill = (bill: MonthlyBill) => {
    const isPayable = bill.status !== "PAID" && bill.status !== "VOID";
    setPaymentForm((old) => ({
      ...old,
      monthlyBillId: isPayable ? bill.id : "",
      amount: isPayable ? String(remainingAmount(bill)) : "",
      note: ""
    }));
  };

  const openPayment = () => {
    const firstUnpaid = paymentBills[0];
    if (!firstUnpaid) {
      setPaymentForm((old) => ({ ...old, monthlyBillId: "", amount: "" }));
      setNotice("暂无待收账单");
      return;
    }
    setPaymentRoomId(roomKeyForBill(firstUnpaid));
    setPaymentBill(firstUnpaid);
    setActiveLayer("payment");
  };

  const openMonthlyDetail = (bill: MonthlyBill) => {
    setSelectedMonthlyBillId(bill.id);
    setPaymentBill(bill);
    setActiveLayer("monthlyDetail");
  };

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setLoaded(false);
    try {
      const nextMonthlyBills = await mobileApi<MonthlyBill[]>("/bills/monthly", token, apiOptions(organizationId));
      const [failedBills, billingBills, nextReadings, nextRooms] = await Promise.all([
        mobileApi<Bill[]>("/bills?status=FAILED", token, apiOptions(organizationId)),
        mobileApi<Bill[]>("/bills?status=BILLING", token, apiOptions(organizationId)),
        mobileApi<MeterReading[]>("/bills/meter-readings", token, apiOptions(organizationId)),
        mobileApi<Room[]>("/apartments/rooms", token, apiOptions(organizationId))
      ]);
      const postpaidReviewBills = [...failedBills, ...billingBills].filter((bill) => bill.mode === "POSTPAID");
      setMonthlyBills(nextMonthlyBills);
      setReviewBills(postpaidReviewBills);
      setReadings(nextReadings);
      setRooms(nextRooms);
      setReadingForm((old) => ({ ...old, roomId: old.roomId || nextRooms[0]?.id || "" }));
      setPaymentForm((old) => ({ ...old, monthlyBillId: old.monthlyBillId || nextMonthlyBills.find((bill) => bill.status !== "PAID")?.id || "" }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "账单加载失败");
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
    if (!loaded || pendingAction !== "payment") return;
    openPayment();
    setPendingAction(undefined);
  }, [loaded, pendingAction, paymentBills, roomById]);

  const submitReading = async () => {
    if (!organizationId) return;
    if (!readingForm.roomId || !readingForm.value.trim()) return setNotice("请选择房间并填写读数");
    await mobileApi("/bills/meter-readings", token, apiOptions(organizationId, "POST", {
      roomId: readingForm.roomId,
      meterType: readingForm.meterType,
      readingDate: readingForm.readingDate,
      value: Number(readingForm.value),
      note: readingForm.note.trim() || undefined
    }));
    setNotice("抄表记录已保存");
    setReadingForm((old) => ({ ...old, value: "", note: "" }));
    setActiveLayer(undefined);
    await loadData();
  };

  const retryBill = async (bill: Bill) => {
    if (!organizationId) return;
    await mobileApi(`/bills/${bill.id}/retry-billing`, token, apiOptions(organizationId, "POST"));
    setNotice("已重新尝试出账");
    await loadData();
  };

  const submitPayment = async () => {
    if (!organizationId) return;
    if (!paymentForm.monthlyBillId || !paymentForm.amount.trim()) return setNotice("请选择月度账单并填写收款金额");
    const bill = monthlyBills.find((item) => item.id === paymentForm.monthlyBillId);
    if (!bill || bill.status === "PAID" || bill.status === "VOID") return setNotice("请选择一张未结清账单");
    const amountError = getPaymentAmountError(paymentForm.amount, remainingAmount(bill));
    if (amountError) return setNotice(amountError);
    try {
      await mobileApi(`/bills/monthly/${paymentForm.monthlyBillId}/payments`, token, apiOptions(organizationId, "POST", {
        amount: Number(paymentForm.amount),
        method: paymentForm.method.trim() || "线下收款",
        note: paymentForm.note.trim() || undefined
      }));
      setNotice("收款已登记");
      setPaymentForm((old) => ({ ...old, monthlyBillId: "", amount: "", note: "" }));
      setActiveLayer(undefined);
      await loadData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "收款失败");
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
    setActiveLayer("utility");
  };

  const submitUtilityReading = async () => {
    if (!organizationId) return;
    if (!utilityForm.billId) return setNotice("请选择水电账单");
    try {
      await mobileApi(`/bills/${utilityForm.billId}/utility-reading`, token, apiOptions(organizationId, "POST", {
        previousWater: Number(utilityForm.previousWater || 0),
        currentWater: Number(utilityForm.currentWater || 0),
        previousPower: Number(utilityForm.previousPower || 0),
        currentPower: Number(utilityForm.currentPower || 0)
      }));
      setNotice("水电读数已录入");
      setActiveLayer(undefined);
      await loadData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "水电录入失败");
    }
  };

  const exportUtilityCsv = async () => {
    if (!organizationId) return;
    try {
      const csv = await mobileText("/bills/utility/pending-export", token, { headers: { "x-organization-id": organizationId } });
      setUtilityCsv(csv);
      setActiveLayer("utilityExport");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "导出失败");
    }
  };

  const importUtilityCsv = async () => {
    if (!organizationId) return;
    if (!utilityCsv.trim()) return setNotice("请粘贴导入内容");
    try {
      await mobileApi("/bills/utility/import", token, apiOptions(organizationId, "POST", { csv: utilityCsv }));
      setNotice("水电读数已导入");
      setUtilityCsv("");
      setActiveLayer(undefined);
      await loadData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "导入失败");
    }
  };

  if (!organizationId) {
    return (
      <View style={styles.panel}>
        <Text style={styles.muted}>请先选择组织</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.statRow}>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>月度账单</Text>
          <Text style={styles.statValue}>{monthlyBills.length}</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>待收金额</Text>
          <Text style={styles.statValue}>¥{money(unpaidTotal)}</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>待处理</Text>
          <Text style={styles.statValue}>{reviewBills.length}</Text>
        </View>
      </View>

      <View style={styles.segment}>
        {([
          ["monthly", "月度账单"],
          ["meter", "抄表"],
          ["review", "出账处理"]
        ] as Array<[BillTabKey, string]>).map(([key, label]) => (
          <TouchableOpacity key={key} style={[styles.segmentItem, tab === key && styles.segmentItemActive]} onPress={() => setTab(key)}>
            <Text style={[styles.segmentText, tab === key && styles.segmentTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.panel}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{tab === "monthly" ? "收款单" : tab === "meter" ? "提前抄表" : "人工处理"}</Text>
          <View style={styles.roomActions}>
            {tab === "monthly" ? (
              <TouchableOpacity style={styles.smallButton} onPress={openPayment}>
                <Text style={styles.smallButtonText}>登记收款</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.smallButton} onPress={loadData} disabled={loading}>
              <Text style={styles.smallButtonText}>{loading ? "刷新中" : "刷新"}</Text>
            </TouchableOpacity>
          </View>
        </View>
        {tab === "meter" ? (
          <View style={styles.roomActions}>
            <TouchableOpacity style={[styles.button, styles.actionButton]} onPress={() => setActiveLayer("reading")}>
              <Text style={styles.buttonText}>录入读数</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryButton, styles.actionButton]} onPress={exportUtilityCsv}>
              <Text style={styles.secondaryButtonText}>导出</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryButton, styles.actionButton]} onPress={() => setActiveLayer("utilityImport")}>
              <Text style={styles.secondaryButtonText}>导入</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {tab === "monthly" ? (
        <>
          {monthlyBills.length === 0 ? <Text style={styles.emptyText}>暂无月度账单。先录入水电读数，再生成账单。</Text> : null}
          {visibleMonthlyBills.map((bill) => {
            const summary = getMonthlyBillCardSummary(bill);
            return (
              <TouchableOpacity key={bill.id} style={styles.billCard} onPress={() => openMonthlyDetail(bill)}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.cardTitle}>{summary.title}</Text>
                    <Text style={styles.muted}>{summary.meta}</Text>
                  </View>
                  <Text style={[styles.statusBadge, statusStyle(bill.status)]}>{statusLabels[bill.status]}</Text>
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
              </TouchableOpacity>
            );
          })}
        </>
      ) : null}

      <TaskSheet
        visible={activeLayer === "monthlyDetail" && !!selectedMonthlyBill}
        variant="drawer"
        title="账单详情"
        subtitle={selectedMonthlyBill ? `${selectedMonthlyBill.tenantName} · ${day(selectedMonthlyBill.billingDate)}` : ""}
        onClose={() => setActiveLayer(undefined)}
        footer={selectedMonthlyBill && selectedMonthlyBill.status !== "PAID" && selectedMonthlyBill.status !== "VOID" ? (
          <TouchableOpacity style={styles.button} onPress={submitPayment}>
            <Text style={styles.buttonText}>确认收款</Text>
          </TouchableOpacity>
        ) : undefined}
      >
        {selectedMonthlyBill ? (
          <>
            <View style={styles.detailPanel}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.cardTitle}>{selectedMonthlyBill.lease?.room?.roomNo ?? "房间"} · 到期 {day(selectedMonthlyBill.dueDate)}</Text>
                  <Text style={styles.muted}>应收 ¥{money(selectedMonthlyBill.totalAmount)} · 已收 ¥{money(selectedMonthlyBill.paidAmount)}</Text>
                </View>
                <Text style={[styles.statusBadge, statusStyle(selectedMonthlyBill.status)]}>{statusLabels[selectedMonthlyBill.status]}</Text>
              </View>
            </View>
            {selectedMonthlyBill.status !== "PAID" && selectedMonthlyBill.status !== "VOID" ? (
              <View style={styles.billDetailBlock}>
                <Text style={styles.fieldLabel}>登记收款</Text>
                <View style={styles.formGrid}>
                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>金额</Text>
                    <TextInput style={styles.input} value={paymentForm.amount} keyboardType="numeric" onChangeText={(value) => setPaymentForm((old) => ({ ...old, amount: value }))} />
                  </View>
                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>方式</Text>
                    <TextInput style={styles.input} value={paymentForm.method} onChangeText={(value) => setPaymentForm((old) => ({ ...old, method: value }))} />
                  </View>
                </View>
                <TextInput style={styles.input} placeholder="备注" value={paymentForm.note} onChangeText={(value) => setPaymentForm((old) => ({ ...old, note: value }))} />
              </View>
            ) : null}
            {(selectedMonthlyBill.bills ?? []).map((child) => (
              <View key={child.id} style={styles.billDetailBlock}>
                <View style={styles.billLine}>
                  <Text style={styles.muted}>{billModeText(child)} · {day(child.periodStart)} 至 {day(child.periodEnd)}</Text>
                  <Text style={styles.cardStat}>¥{money(child.totalAmount)}</Text>
                </View>
                {(child.items ?? []).map((item) => (
                  <View key={item.id} style={styles.billItemLine}>
                    <Text style={styles.muted}>{item.name}</Text>
                    <Text style={styles.muted}>¥{money(item.amount)}</Text>
                  </View>
                ))}
                {child.mode === "POSTPAID" ? (
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => openUtilityReading(child)}>
                    <Text style={styles.secondaryButtonText}>录入本期水电</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
            {(selectedMonthlyBill.payments ?? []).length ? (
              <View style={styles.billDetailBlock}>
                <Text style={styles.fieldLabel}>收款记录</Text>
                {(selectedMonthlyBill.payments ?? []).map((payment) => (
                  <View key={payment.id} style={styles.billItemLine}>
                    <Text style={styles.muted}>{day(payment.paidAt)} · {payment.method}</Text>
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

      {tab === "meter" ? (
        <>
          {readings.slice(0, 12).map((reading) => (
            <View key={reading.id} style={styles.readingRow}>
              <View>
                <Text style={styles.cardTitle}>{reading.room?.roomNo ?? "房间"} · {meterLabels[reading.meterType]}</Text>
                <Text style={styles.muted}>{day(reading.readingDate)} · {reading.lease?.tenantName ?? "未关联租约"}</Text>
              </View>
              <Text style={styles.billAmount}>{money(reading.value)}</Text>
            </View>
          ))}
        </>
      ) : null}

      <TaskSheet
        visible={activeLayer === "payment"}
        variant="drawer"
        title="登记收款"
        subtitle={selectedPaymentBill ? `${selectedPaymentBill.tenantName} · 剩余 ¥${money(remainingAmount(selectedPaymentBill))}` : "选择公寓和房间账单"}
        onClose={() => setActiveLayer(undefined)}
        footer={(
          <TouchableOpacity style={styles.button} onPress={submitPayment}>
            <Text style={styles.buttonText}>确认收款</Text>
          </TouchableOpacity>
        )}
      >
        <RoomBillSelector
          rooms={selectorRooms}
          selectedRoomId={paymentRoomId}
          onSelectRoom={(roomId) => {
            setPaymentRoomId(roomId);
            const firstBill = paymentBills.find((bill) => roomKeyForBill(bill) === roomId);
            if (firstBill) {
              setPaymentBill(firstBill);
            } else {
              setPaymentForm((old) => ({ ...old, monthlyBillId: "", amount: "", note: "" }));
            }
          }}
        />
        <View style={styles.billDetailBlock}>
          <Text style={styles.fieldLabel}>选择收款账单</Text>
          {paymentRoomBills.map((bill) => (
            <TouchableOpacity
              key={bill.id}
              style={[styles.feeItem, paymentForm.monthlyBillId === bill.id && styles.feeItemActive]}
              onPress={() => setPaymentBill(bill)}
            >
              <View>
                <Text style={styles.cardTitle}>{day(bill.billingDate)}</Text>
                <Text style={styles.muted}>剩余 ¥{money(remainingAmount(bill))}</Text>
              </View>
              <Text style={[styles.statusBadge, statusStyle(bill.status)]}>{statusLabels[bill.status]}</Text>
            </TouchableOpacity>
          ))}
          {paymentRoomId && paymentRoomBills.length === 0 ? <Text style={styles.muted}>该房间暂无待收账单</Text> : null}
        </View>
        <View style={styles.billDetailBlock}>
          <Text style={styles.fieldLabel}>收款信息</Text>
          <View style={styles.formGrid}>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>金额</Text>
              <TextInput style={styles.input} value={paymentForm.amount} keyboardType="numeric" onChangeText={(value) => setPaymentForm((old) => ({ ...old, amount: value }))} />
            </View>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>方式</Text>
              <TextInput style={styles.input} value={paymentForm.method} onChangeText={(value) => setPaymentForm((old) => ({ ...old, method: value }))} />
            </View>
          </View>
          <TextInput style={styles.input} placeholder="备注" value={paymentForm.note} onChangeText={(value) => setPaymentForm((old) => ({ ...old, note: value }))} />
        </View>
      </TaskSheet>

      <TaskSheet
        visible={activeLayer === "reading"}
        variant="drawer"
        title="录入读数"
        subtitle="选择房间、水电类型并填写本次读数"
        onClose={() => setActiveLayer(undefined)}
        footer={(
          <TouchableOpacity style={styles.button} onPress={submitReading}>
            <Text style={styles.buttonText}>保存读数</Text>
          </TouchableOpacity>
        )}
      >
        <View style={styles.formGrid}>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>日期</Text>
            <DateField value={readingForm.readingDate} onChange={(value) => setReadingForm((old) => ({ ...old, readingDate: value }))} />
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>读数</Text>
            <TextInput style={styles.input} value={readingForm.value} keyboardType="numeric" onChangeText={(value) => setReadingForm((old) => ({ ...old, value }))} />
          </View>
        </View>
        <View style={styles.segment}>
          {(["WATER", "POWER"] as MeterType[]).map((meterType) => (
            <TouchableOpacity key={meterType} style={[styles.segmentItem, readingForm.meterType === meterType && styles.segmentItemActive]} onPress={() => setReadingForm((old) => ({ ...old, meterType }))}>
              <Text style={[styles.segmentText, readingForm.meterType === meterType && styles.segmentTextActive]}>{meterLabels[meterType]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <RoomBillSelector
          rooms={selectorRooms}
          selectedRoomId={readingForm.roomId}
          onSelectRoom={(roomId) => setReadingForm((old) => ({ ...old, roomId }))}
        />
        <TextInput style={styles.input} placeholder="备注" value={readingForm.note} onChangeText={(value) => setReadingForm((old) => ({ ...old, note: value }))} />
      </TaskSheet>

      {tab === "review" ? (
        <>
          {reviewBills.length === 0 ? <Text style={styles.emptyText}>没有出账失败的后付费账单</Text> : null}
          {reviewBills.map((bill) => (
            <View key={bill.id} style={styles.billCard}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.cardTitle}>{bill.lease?.tenantName ?? "租客"} · {bill.lease?.room?.roomNo ?? "房间"}</Text>
                  <Text style={styles.muted}>{day(bill.periodStart)} 至 {day(bill.periodEnd)}</Text>
                </View>
                <Text style={[styles.statusBadge, statusStyle(bill.status)]}>{statusLabels[bill.status]}</Text>
              </View>
              <Text style={styles.smallDangerText}>{bill.failureReason ?? "需要补录或修正水电读数"}</Text>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => retryBill(bill)}>
                <Text style={styles.secondaryButtonText}>重新出账并生成月度账单</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={() => openUtilityReading(bill)}>
                <Text style={styles.buttonText}>直接录入水电读数</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      ) : null}

      <TaskSheet
        visible={activeLayer === "utility"}
        variant="drawer"
        title="录入本期水电"
        subtitle="按账单填写上期和本期读数"
        onClose={() => setActiveLayer(undefined)}
        footer={(
          <TouchableOpacity style={styles.button} onPress={submitUtilityReading}>
            <Text style={styles.buttonText}>保存水电读数</Text>
          </TouchableOpacity>
        )}
      >
        <View style={styles.formGrid}>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>上月水表</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={utilityForm.previousWater} onChangeText={(value) => setUtilityForm((old) => ({ ...old, previousWater: value }))} />
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>本月水表</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={utilityForm.currentWater} onChangeText={(value) => setUtilityForm((old) => ({ ...old, currentWater: value }))} />
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>上月电表</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={utilityForm.previousPower} onChangeText={(value) => setUtilityForm((old) => ({ ...old, previousPower: value }))} />
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>本月电表</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={utilityForm.currentPower} onChangeText={(value) => setUtilityForm((old) => ({ ...old, currentPower: value }))} />
          </View>
        </View>
      </TaskSheet>

      <TaskSheet
        visible={activeLayer === "utilityImport"}
        variant="drawer"
        title="导入水电读数"
        subtitle="粘贴从导出模板填写后的 CSV 内容"
        onClose={() => setActiveLayer(undefined)}
        footer={(
          <TouchableOpacity style={styles.button} onPress={importUtilityCsv}>
            <Text style={styles.buttonText}>确认导入</Text>
          </TouchableOpacity>
        )}
      >
        <TextInput style={[styles.input, styles.textarea]} multiline value={utilityCsv} onChangeText={setUtilityCsv} placeholder="billId,房间号,租客,交租日,水电周期开始,水电周期结束,上月水表,本月水表,上月电表,本月电表,失败原因" />
      </TaskSheet>

      <TaskSheet
        visible={activeLayer === "utilityExport"}
        variant="drawer"
        title="待录入水电导出"
        subtitle="复制下方 CSV 内容填写后再导入"
        onClose={() => setActiveLayer(undefined)}
      >
        <TextInput style={[styles.input, styles.textarea]} multiline value={utilityCsv} onChangeText={setUtilityCsv} />
      </TaskSheet>
    </>
  );
}
