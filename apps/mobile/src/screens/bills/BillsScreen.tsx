import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { DateField } from "../../components/DateField";
import { TaskSheet } from "../../components/TaskSheet";
import { mobileApi } from "../../services";
import { styles } from "../../theme/styles";
import type { Bill, BillStatus, MeterReading, MeterType, MonthlyBill, Room } from "../../types";

type Props = {
  token: string;
  organizationId?: string;
  setNotice: (notice: string) => void;
};

type TabKey = "monthly" | "meter" | "review";
type BillLayer = "payment" | "reading";

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

export default function BillsScreen({ token, organizationId, setNotice }: Props) {
  const [tab, setTab] = useState<TabKey>("monthly");
  const [monthlyBills, setMonthlyBills] = useState<MonthlyBill[]>([]);
  const [reviewBills, setReviewBills] = useState<Bill[]>([]);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeLayer, setActiveLayer] = useState<BillLayer>();
  const [readingForm, setReadingForm] = useState<ReadingForm>({ roomId: "", meterType: "WATER", readingDate: today(), value: "", note: "" });
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({ monthlyBillId: "", amount: "", method: "线下收款", note: "" });

  const unpaidTotal = useMemo(
    () => monthlyBills.filter((bill) => bill.status !== "PAID" && bill.status !== "VOID").reduce((sum, bill) => sum + remainingAmount(bill), 0),
    [monthlyBills]
  );
  const selectedPaymentBill = useMemo(() => monthlyBills.find((bill) => bill.id === paymentForm.monthlyBillId), [monthlyBills, paymentForm.monthlyBillId]);
  const unpaidBills = useMemo(() => monthlyBills.filter((bill) => bill.status !== "PAID" && bill.status !== "VOID"), [monthlyBills]);

  const openPayment = () => {
    const firstUnpaid = unpaidBills[0];
    if (!firstUnpaid) {
      setPaymentForm((old) => ({ ...old, monthlyBillId: "", amount: "" }));
      setNotice("暂无待收账单");
      return;
    }
    setPaymentForm((old) => ({
      ...old,
      monthlyBillId: firstUnpaid.id,
      amount: String(remainingAmount(firstUnpaid))
    }));
    setActiveLayer("payment");
  };

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const [nextMonthlyBills, failedBills, billingBills, nextReadings, nextRooms] = await Promise.all([
        mobileApi<MonthlyBill[]>("/bills/monthly", token, apiOptions(organizationId)),
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
    }
  }, [organizationId, setNotice, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const generateBills = async () => {
    if (!organizationId) return;
    const activeLeaseIds = rooms.flatMap((room) => room.leases ?? []).filter((lease) => lease.status === "ACTIVE").map((lease) => lease.id);
    if (!activeLeaseIds.length) return setNotice("暂无有效租约可生成账单");
    await Promise.all(activeLeaseIds.map((leaseId) => mobileApi("/bills/generate", token, apiOptions(organizationId, "POST", { leaseId }))));
    setNotice("账单已生成，完成出账的月度账单会自动出现");
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
    if (Number(paymentForm.amount) > remainingAmount(bill)) return setNotice(`收款金额不能超过剩余应收 ¥${money(remainingAmount(bill))}`);
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
        ] as Array<[TabKey, string]>).map(([key, label]) => (
          <TouchableOpacity key={key} style={[styles.segmentItem, tab === key && styles.segmentItemActive]} onPress={() => setTab(key)}>
            <Text style={[styles.segmentText, tab === key && styles.segmentTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.panel}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{tab === "monthly" ? "收款单" : tab === "meter" ? "提前抄表" : "人工处理"}</Text>
          <TouchableOpacity style={styles.smallButton} onPress={loadData} disabled={loading}>
            <Text style={styles.smallButtonText}>{loading ? "刷新中" : "刷新"}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.secondaryButton} onPress={generateBills}>
          <Text style={styles.secondaryButtonText}>生成当前租约账单</Text>
        </TouchableOpacity>
        {tab === "monthly" ? (
          <TouchableOpacity style={styles.button} onPress={openPayment}>
            <Text style={styles.buttonText}>登记收款</Text>
          </TouchableOpacity>
        ) : null}
        {tab === "meter" ? (
          <TouchableOpacity style={styles.button} onPress={() => setActiveLayer("reading")}>
            <Text style={styles.buttonText}>录入读数</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {tab === "monthly" ? (
        <>
          {monthlyBills.length === 0 ? <Text style={styles.emptyText}>暂无月度账单。先录入水电读数，再生成账单。</Text> : null}
          {monthlyBills.map((bill) => (
            <View key={bill.id} style={styles.billCard}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.cardTitle}>{bill.tenantName} · {day(bill.billingDate)}</Text>
                  <Text style={styles.muted}>{bill.lease?.room?.roomNo ?? "房间"} · 到期 {day(bill.dueDate)}</Text>
                </View>
                <Text style={[styles.statusBadge, statusStyle(bill.status)]}>{statusLabels[bill.status]}</Text>
              </View>
              <View style={styles.billAmountRow}>
                <Text style={styles.billAmount}>¥{money(bill.totalAmount)}</Text>
                <Text style={styles.muted}>已收 ¥{money(bill.paidAmount)}</Text>
              </View>
              {(bill.bills ?? []).map((child) => (
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
                </View>
              ))}
              {(bill.payments ?? []).length ? (
                <View style={styles.billDetailBlock}>
                  <Text style={styles.fieldLabel}>收款记录</Text>
                  {(bill.payments ?? []).map((payment) => (
                    <View key={payment.id} style={styles.billItemLine}>
                      <Text style={styles.muted}>{day(payment.paidAt)} · {payment.method}</Text>
                      <Text style={styles.cardStat}>¥{money(payment.amount)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </>
      ) : null}

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
        variant="bottom"
        title="登记收款"
        subtitle={selectedPaymentBill ? `${selectedPaymentBill.tenantName} · 应收 ¥${money(selectedPaymentBill.totalAmount)}` : "选择一张待收账单"}
        onClose={() => setActiveLayer(undefined)}
        footer={(
          <TouchableOpacity style={styles.button} onPress={submitPayment}>
            <Text style={styles.buttonText}>确认收款</Text>
          </TouchableOpacity>
        )}
      >
        <View style={styles.billChoiceList}>
          {unpaidBills.slice(0, 4).map((bill) => (
            <TouchableOpacity
              key={bill.id}
              style={[styles.feeItem, paymentForm.monthlyBillId === bill.id && styles.feeItemActive]}
              onPress={() => setPaymentForm((old) => ({ ...old, monthlyBillId: bill.id, amount: String(Number(bill.totalAmount) - Number(bill.paidAmount)) }))}
            >
              <View>
                <Text style={styles.cardTitle}>{bill.tenantName} · {day(bill.billingDate)}</Text>
                <Text style={styles.muted}>剩余 ¥{money(Number(bill.totalAmount) - Number(bill.paidAmount))}</Text>
              </View>
              <Text style={[styles.statusBadge, statusStyle(bill.status)]}>{statusLabels[bill.status]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {unpaidBills.length === 0 ? <Text style={styles.muted}>暂无待收账单</Text> : null}
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
        <View style={styles.roomGrid}>
          {rooms.slice(0, 8).map((room) => (
            <TouchableOpacity key={room.id} style={[styles.feeItem, readingForm.roomId === room.id && styles.feeItemActive]} onPress={() => setReadingForm((old) => ({ ...old, roomId: room.id }))}>
              <View>
                <Text style={styles.cardTitle}>{room.apartment?.name} · {room.roomNo}</Text>
                <Text style={styles.muted}>{room.leases?.find((lease) => lease.status === "ACTIVE")?.tenantName ?? "暂无有效租约"}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
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
            </View>
          ))}
        </>
      ) : null}
    </>
  );
}
