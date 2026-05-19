import { useState } from 'react';
import { View, Text } from '@tarojs/components';
import { Button, Input, Badge } from '../../../components/ui';
import { TaskSheet } from '../../../components/TaskSheet';
import { money, day } from '../../../utils/format';
import { statusLabels, toneForBillStatus, billModeText } from '../constants';
import { getPaymentAmountError } from '../utils';
import type { MonthlyBill, Bill } from '../../../types/domain';

interface MonthlyDetailSheetProps {
  visible: boolean;
  bill: MonthlyBill | undefined;
  onPayment: (monthlyBillId: string, amount: string, method: string, note: string) => Promise<void> | void;
  onUtilityReading: (bill: Bill) => void;
  onEditItem: (item: { id: string; billId: string; name: string; amount: number; note: string }) => void;
  onDeleteChild: (childId: string) => void;
  onClose: () => void;
}

export function MonthlyDetailSheet({
  visible, bill, onPayment, onUtilityReading, onEditItem, onDeleteChild, onClose
}: MonthlyDetailSheetProps) {
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "线下收款", note: "" });
  const [paying, setPaying] = useState(false);

  const remaining = bill ? Number(bill.totalAmount) - Number(bill.paidAmount) : 0;
  const canPay = bill && bill.status !== "PAID" && bill.status !== "VOID";

  const handlePayment = async () => {
    if (!bill) return;
    const error = getPaymentAmountError(paymentForm.amount, remaining);
    if (error) return;
    setPaying(true);
    try {
      await onPayment(bill.id, paymentForm.amount, paymentForm.method, paymentForm.note);
      setPaymentForm({ amount: "", method: "线下收款", note: "" });
    } finally {
      setPaying(false);
    }
  };

  return (
    <TaskSheet
      visible={visible && !!bill}
      title="账单详情"
      onClose={onClose}
      footer={<Button variant="ghost" onClick={onClose}>关闭</Button>}
    >
      {bill ? (
        <>
          <View className="detail-panel">
            <View className="bill-card-header">
              <View>
                <Text className="card-title">{bill.lease?.room?.roomNo ?? "房间"} · 到期 {day(bill.dueDate)}</Text>
                <Text className="text-muted">应收 ¥{money(bill.totalAmount)} · 已收 ¥{money(bill.paidAmount)}</Text>
              </View>
              <Badge tone={toneForBillStatus(bill.status)}>{statusLabels[bill.status]}</Badge>
            </View>
          </View>

          {canPay ? (
            <View className="detail-panel">
              <Text className="field-label">登记收款</Text>
              <View className="form-grid">
                <Input label="收款金额" placeholder="请输入金额" type="number" value={paymentForm.amount} onChange={(value) => setPaymentForm((old) => ({ ...old, amount: value }))} />
                <Input label="收款方式" placeholder="例如 线下收款" value={paymentForm.method} onChange={(value) => setPaymentForm((old) => ({ ...old, method: value }))} />
              </View>
              <Input label="备注" placeholder="可选" value={paymentForm.note} onChange={(value) => setPaymentForm((old) => ({ ...old, note: value }))} />
              <Button loading={paying} disabled={paying} onClick={handlePayment}>确认收款</Button>
            </View>
          ) : null}

          {(bill.bills ?? []).map((child) => (
            <View key={child.id} className="detail-panel">
              <View className="detail-row">
                <Text className="text-muted">{billModeText(child.mode)} · {day(child.periodStart)} 至 {day(child.periodEnd)}</Text>
                <View className="action-row-inline">
                  <Text className="card-stat">¥{money(child.totalAmount)}</Text>
                  {child.status !== "PAID" ? (
                    <Text className="danger-text" onClick={() => onDeleteChild(child.id)}>删除</Text>
                  ) : null}
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
                        onClick={() => onEditItem({ id: item.id, billId: child.id, name: item.name, amount: Number(item.amount), note: item.note ?? "" })}
                      >
                        修改
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
              {child.mode === "POSTPAID" ? <Button variant="secondary" size="small" onClick={() => onUtilityReading(child)}>录入本期水电</Button> : null}
            </View>
          ))}

          {(bill.payments ?? []).length ? (
            <View className="detail-panel">
              <Text className="field-label">收款记录</Text>
              {(bill.payments ?? []).map((payment) => (
                <View key={payment.id} className="detail-row">
                  <Text className="text-muted">{day(payment.paidAt)} · {payment.method}</Text>
                  <Text className="card-stat">¥{money(payment.amount)}</Text>
                </View>
              ))}
            </View>
          ) : <Text className="text-muted">暂无收款记录</Text>}
        </>
      ) : null}
    </TaskSheet>
  );
}
