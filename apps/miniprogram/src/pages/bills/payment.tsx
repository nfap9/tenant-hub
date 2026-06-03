import { useState, useMemo, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAppSession } from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { Button, Card, Input, Badge } from '../../components/ui';
import { money } from '../../utils/format';
import { statusLabels, toneForBillStatus } from './constants';
import {
  remainingAmount,
  roomKeyForBill,
  sortBillsForList,
  getPaymentAmountError,
} from './utils';
import type { Bill, Room } from '../../types/domain';
import './index.scss';

export default function PaymentPage() {
  const { currentOrgId } = useAppSession();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [paymentRoomId, setPaymentRoomId] = useState('');
  const [form, setForm] = useState({
    billId: '',
    amount: '',
    method: '线下收款',
    note: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    if (!currentOrgId) return;
    try {
      const [nextRooms, allBills] = await Promise.all([
        apiClient<Room[]>('/apartments/rooms', {
          organizationId: currentOrgId,
        }),
        apiClient<Bill[]>('/bills', {
          organizationId: currentOrgId,
        }),
      ]);
      setRooms(nextRooms);
      setBills(allBills);
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '加载失败',
        icon: 'none',
      });
    }
  };

  useEffect(() => {
    loadData();
  }, [currentOrgId]);

  const paymentBills = useMemo(
    () =>
      sortBillsForList(
        bills.filter(
          (b) => b.status === 'UNPAID' || b.status === 'PARTIAL_PAID'
        )
      ),
    [bills]
  );
  const roomBills = useMemo(
    () => paymentBills.filter((bill) => roomKeyForBill(bill) === paymentRoomId),
    [paymentBills, paymentRoomId]
  );

  useEffect(() => {
    if (paymentBills.length > 0 && !paymentRoomId) {
      const first = paymentBills[0];
      if (first) {
        setPaymentRoomId(roomKeyForBill(first));
        const isPayable =
          first.status !== 'PAID' &&
          first.status !== 'VOID' &&
          first.status !== 'REFUNDED';
        setForm({
          billId: isPayable ? first.id : '',
          amount: isPayable ? String(remainingAmount(first)) : '',
          method: '线下收款',
          note: '',
        });
      }
    }
  }, [paymentBills, paymentRoomId]);

  const handleRoomClick = (roomId: string) => {
    setPaymentRoomId(roomId);
    const firstBill = paymentBills.find(
      (bill) => roomKeyForBill(bill) === roomId
    );
    if (firstBill) {
      const isPayable =
        firstBill.status !== 'PAID' && firstBill.status !== 'VOID';
      setForm({
        billId: isPayable ? firstBill.id : '',
        amount: isPayable ? String(remainingAmount(firstBill)) : '',
        method: '线下收款',
        note: '',
      });
    } else {
      setForm({ billId: '', amount: '', method: '线下收款', note: '' });
    }
  };

  const handleBillClick = (bill: Bill) => {
    const isPayable = bill.status !== 'PAID' && bill.status !== 'VOID';
    setForm({
      billId: isPayable ? bill.id : '',
      amount: isPayable ? String(remainingAmount(bill)) : '',
      method: '线下收款',
      note: '',
    });
  };

  const handleBack = () => {
    Taro.navigateBack();
  };

  const handleSubmit = async () => {
    if (!currentOrgId || !form.billId || !form.amount.trim()) return;
    const bill = bills.find((item) => item.id === form.billId);
    if (!bill || bill.status === 'PAID' || bill.status === 'VOID') return;
    const amountError = getPaymentAmountError(
      form.amount,
      remainingAmount(bill)
    );
    if (amountError) {
      Taro.showToast({ title: amountError, icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      await apiClient(`/bills/${form.billId}/payments`, {
        method: 'POST',
        body: {
          amount: Number(form.amount),
          method: form.method.trim() || '线下收款',
          note: form.note.trim() || undefined,
        },
        organizationId: currentOrgId,
      });
      Taro.showToast({ title: '收款已登记', icon: 'success' });
      Taro.navigateBack();
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '收款失败',
        icon: 'none',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="page-container">
      <View className="sub-page-header">
        <Button
          className="page-back-button"
          variant="ghost"
          size="small"
          onClick={handleBack}
        >
          ‹ 返回
        </Button>
      </View>
      <Card title="登记收款">
        <Text className="field-label">选择房间</Text>
        <View className="segment">
          {rooms.map((room) => (
            <View
              key={room.id}
              className={`segment-item ${paymentRoomId === room.id ? 'segment-item--active' : ''}`}
              onClick={() => handleRoomClick(room.id)}
            >
              <Text
                className={`segment-text ${paymentRoomId === room.id ? 'segment-text--active' : ''}`}
              >
                {room.roomNo}
              </Text>
            </View>
          ))}
        </View>
        <Text className="field-label">选择账单</Text>
        {roomBills.map((bill) => (
          <View
            key={bill.id}
            className={`bill-select-card ${form.billId === bill.id ? 'bill-select-card--active' : ''}`}
            onClick={() => handleBillClick(bill)}
          >
            <Text className="card-title">{bill.billingDate.slice(0, 10)}</Text>
            <Text className="text-muted">
              剩余 ¥{money(remainingAmount(bill))}
            </Text>
            <Badge tone={toneForBillStatus(bill.status)}>
              {statusLabels[bill.status]}
            </Badge>
          </View>
        ))}
        {paymentRoomId && roomBills.length === 0 ? (
          <Text className="text-muted">该房间暂无待收账单</Text>
        ) : null}
        <Text className="field-label">收款信息</Text>
        <View className="form-grid">
          <Input
            label="收款金额"
            placeholder="请输入金额"
            type="number"
            value={form.amount}
            onChange={(value) => setForm((old) => ({ ...old, amount: value }))}
          />
          <Input
            label="收款方式"
            placeholder="例如 线下收款"
            value={form.method}
            onChange={(value) => setForm((old) => ({ ...old, method: value }))}
          />
        </View>
        <Input
          label="备注"
          placeholder="可选"
          value={form.note}
          onChange={(value) => setForm((old) => ({ ...old, note: value }))}
        />
        <Button
          loading={submitting}
          disabled={submitting}
          onClick={handleSubmit}
        >
          确认收款
        </Button>
        <Button variant="ghost" onClick={handleBack}>
          取消
        </Button>
      </Card>
    </View>
  );
}
