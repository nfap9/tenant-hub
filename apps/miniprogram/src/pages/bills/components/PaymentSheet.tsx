import { useState, useMemo, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import { Button, Input, Badge } from '../../../components/ui';
import { TaskSheet } from '../../../components/TaskSheet';
import { money } from '../../../utils/format';
import { statusLabels, toneForBillStatus } from '../constants';
import { remainingAmount, roomKeyForBill, sortMonthlyBillsForList, getPaymentAmountError } from '../utils';
import type { MonthlyBill, Room } from '../../../types/domain';

interface PaymentSheetProps {
  visible: boolean;
  rooms: Room[];
  bills: MonthlyBill[];
  onSubmit: (monthlyBillId: string, amount: string, method: string, note: string) => Promise<void> | void;
  onClose: () => void;
}

export function PaymentSheet({ visible, rooms, bills, onSubmit, onClose }: PaymentSheetProps) {
  const [paymentRoomId, setPaymentRoomId] = useState("");
  const [form, setForm] = useState({ monthlyBillId: "", amount: "", method: "线下收款", note: "" });
  const [submitting, setSubmitting] = useState(false);

  const paymentBills = useMemo(() => sortMonthlyBillsForList(bills), [bills]);
  const roomBills = useMemo(() => paymentBills.filter((bill) => roomKeyForBill(bill) === paymentRoomId), [paymentBills, paymentRoomId]);

  useEffect(() => {
    if (visible && bills.length > 0 && !paymentRoomId) {
      const first = paymentBills[0];
      if (first) {
        setPaymentRoomId(roomKeyForBill(first));
        setPaymentBill(first);
      }
    }
  }, [visible, bills, paymentBills, paymentRoomId]);

  const setPaymentBill = (bill: MonthlyBill) => {
    const isPayable = bill.status !== "PAID" && bill.status !== "VOID";
    setForm({ monthlyBillId: isPayable ? bill.id : "", amount: isPayable ? String(remainingAmount(bill)) : "", method: "线下收款", note: "" });
  };

  const handleRoomClick = (roomId: string) => {
    setPaymentRoomId(roomId);
    const firstBill = paymentBills.find((bill) => roomKeyForBill(bill) === roomId);
    if (firstBill) setPaymentBill(firstBill);
    else setForm({ monthlyBillId: "", amount: "", method: "线下收款", note: "" });
  };

  const handleSubmit = async () => {
    if (!form.monthlyBillId || !form.amount.trim()) return;
    const bill = bills.find((item) => item.id === form.monthlyBillId);
    if (!bill || bill.status === "PAID" || bill.status === "VOID") return;
    const amountError = getPaymentAmountError(form.amount, remainingAmount(bill));
    if (amountError) return;
    setSubmitting(true);
    try {
      await onSubmit(form.monthlyBillId, form.amount, form.method, form.note);
      setForm({ monthlyBillId: "", amount: "", method: "线下收款", note: "" });
      setPaymentRoomId("");
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TaskSheet
      visible={visible}
      title="登记收款"
      onClose={onClose}
      footer={(
        <>
          <Button loading={submitting} disabled={submitting} onClick={handleSubmit}>确认收款</Button>
          <Button variant="ghost" onClick={onClose}>取消</Button>
        </>
      )}
    >
      <Text className="field-label">选择房间</Text>
      <View className="segment">
        {rooms.map((room) => (
          <View key={room.id} className={`segment-item ${paymentRoomId === room.id ? 'segment-item--active' : ''}`} onClick={() => handleRoomClick(room.id)}>
            <Text className={`segment-text ${paymentRoomId === room.id ? 'segment-text--active' : ''}`}>{room.roomNo}</Text>
          </View>
        ))}
      </View>
      <Text className="field-label">选择账单</Text>
      {roomBills.map((bill) => (
        <View key={bill.id} className={`bill-select-card ${form.monthlyBillId === bill.id ? 'bill-select-card--active' : ''}`} onClick={() => setPaymentBill(bill)}>
          <Text className="card-title">{bill.billingDate.slice(0, 10)}</Text>
          <Text className="text-muted">剩余 ¥{money(remainingAmount(bill))}</Text>
          <Badge tone={toneForBillStatus(bill.status)}>{statusLabels[bill.status]}</Badge>
        </View>
      ))}
      {paymentRoomId && roomBills.length === 0 ? <Text className="text-muted">该房间暂无待收账单</Text> : null}
      <Text className="field-label">收款信息</Text>
      <View className="form-grid">
        <Input label="收款金额" placeholder="请输入金额" type="number" value={form.amount} onChange={(value) => setForm((old) => ({ ...old, amount: value }))} />
        <Input label="收款方式" placeholder="例如 线下收款" value={form.method} onChange={(value) => setForm((old) => ({ ...old, method: value }))} />
      </View>
      <Input label="备注" placeholder="可选" value={form.note} onChange={(value) => setForm((old) => ({ ...old, note: value }))} />
    </TaskSheet>
  );
}
