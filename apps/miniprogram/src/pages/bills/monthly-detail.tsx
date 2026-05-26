import { useState, useMemo } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import { useAppSession } from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { Button, Input, Badge } from '../../components/ui';
import { money, day } from '../../utils/format';
import { statusLabels, toneForBillStatus, billModeText } from './constants';
import { getPaymentAmountError, groupBills } from './utils';
import type { Bill } from '../../types/domain';
import type { BillGroup } from './utils';
import './index.scss';

export default function MonthlyDetailPage() {
  const { currentOrgId } = useAppSession();
  const { params } = useRouter();
  const groupId = params.id;

  const [allBills, setAllBills] = useState<Bill[]>([]);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: '线下收款',
    note: '',
  });
  const [paying, setPaying] = useState(false);

  const loadData = async () => {
    if (!currentOrgId) return;
    try {
      const data = await apiClient<Bill[]>('/bills', {
        organizationId: currentOrgId,
      });
      setAllBills(data);
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '加载失败',
        icon: 'none',
      });
    }
  };

  useDidShow(() => {
    loadData();
  });

  const group = useMemo<BillGroup | undefined>(() => {
    if (!groupId) return undefined;
    const groups = groupBills(allBills);
    return groups.find((g) => g.id === groupId);
  }, [allBills, groupId]);

  const remaining = useMemo(
    () => (group ? group.totalAmount - group.paidAmount : 0),
    [group]
  );
  const canPay = useMemo(
    () => group && group.status !== 'PAID' && group.status !== 'VOID',
    [group]
  );

  const handleBack = () => {
    Taro.navigateBack();
  };

  const handlePayment = async () => {
    if (!currentOrgId || !group) return;
    const error = getPaymentAmountError(paymentForm.amount, remaining);
    if (error) {
      Taro.showToast({ title: error, icon: 'none' });
      return;
    }
    setPaying(true);
    try {
      let unapplied = Number(paymentForm.amount);
      const unpaidBills = group.bills.filter(
        (b) => b.status !== 'PAID' && b.status !== 'VOID'
      );
      for (const bill of unpaidBills) {
        if (unapplied <= 0) break;
        const billRemaining =
          Number(bill.totalAmount) - Number(bill.paidAmount);
        if (billRemaining <= 0) continue;
        const applyAmount = Math.min(unapplied, billRemaining);
        await apiClient(`/bills/${bill.id}/payments`, {
          method: 'POST',
          body: {
            amount: applyAmount,
            method: paymentForm.method.trim() || '线下收款',
            note: paymentForm.note.trim() || undefined,
          },
          organizationId: currentOrgId,
        });
        unapplied -= applyAmount;
      }
      Taro.showToast({ title: '收款已登记', icon: 'success' });
      setPaymentForm({ amount: '', method: '线下收款', note: '' });
      await loadData();
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '收款失败',
        icon: 'none',
      });
    } finally {
      setPaying(false);
    }
  };

  const handleDeleteChild = async (childId: string) => {
    if (!currentOrgId) return;
    const res = await Taro.showModal({
      title: '删除账单',
      content: '删除后不可恢复，是否确认？',
      confirmText: '确认删除',
      confirmColor: '#ff4d4f',
    });
    if (!res.confirm) return;
    try {
      await apiClient(`/bills/${childId}`, {
        method: 'DELETE',
        organizationId: currentOrgId,
      });
      Taro.showToast({ title: '账单已删除', icon: 'success' });
      await loadData();
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '删除失败',
        icon: 'none',
      });
    }
  };

  const handleUtilityReading = (childBillId: string) => {
    Taro.navigateTo({ url: `/pages/bills/utility?billId=${childBillId}` });
  };

  const handleEditItem = (item: {
    id: string;
    billId: string;
    name: string;
    amount: number;
    note: string;
  }) => {
    Taro.navigateTo({
      url: `/pages/bills/edit-item?billId=${item.billId}&itemId=${item.id}&name=${encodeURIComponent(item.name)}&amount=${item.amount}&note=${encodeURIComponent(item.note)}`,
    });
  };

  if (!group) {
    return (
      <View className="page-container">
        <Text className="text-muted">账单不存在或已删除</Text>
      </View>
    );
  }

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

      <View className="detail-panel">
        <View className="bill-card-header">
          <View>
            <Text className="card-title">
              {group.lease?.room?.roomNo ?? '房间'} · 到期 {day(group.dueDate)}
            </Text>
            <Text className="text-muted">
              应收 ¥{money(group.totalAmount)} · 已收 ¥{money(group.paidAmount)}
            </Text>
          </View>
          <Badge tone={toneForBillStatus(group.status)}>
            {statusLabels[group.status]}
          </Badge>
        </View>
      </View>

      {canPay ? (
        <View className="detail-panel">
          <Text className="field-label">登记收款</Text>
          <View className="form-grid">
            <Input
              label="收款金额"
              placeholder="请输入金额"
              type="number"
              value={paymentForm.amount}
              onChange={(value) =>
                setPaymentForm((old) => ({ ...old, amount: value }))
              }
            />
            <Input
              label="收款方式"
              placeholder="例如 线下收款"
              value={paymentForm.method}
              onChange={(value) =>
                setPaymentForm((old) => ({ ...old, method: value }))
              }
            />
          </View>
          <Input
            label="备注"
            placeholder="可选"
            value={paymentForm.note}
            onChange={(value) =>
              setPaymentForm((old) => ({ ...old, note: value }))
            }
          />
          <Button loading={paying} disabled={paying} onClick={handlePayment}>
            确认收款
          </Button>
        </View>
      ) : null}

      {(group.bills ?? []).map((child) => (
        <View key={child.id} className="detail-panel">
          <View className="detail-row">
            <Text className="text-muted">
              {billModeText(child.mode)} · {day(child.periodStart)} 至{' '}
              {day(child.periodEnd)}
            </Text>
            <View className="action-row-inline">
              <Text className="card-stat">¥{money(child.totalAmount)}</Text>
              {child.status !== 'PAID' ? (
                <Text
                  className="danger-text"
                  onClick={() => handleDeleteChild(child.id)}
                >
                  删除
                </Text>
              ) : null}
            </View>
          </View>
          {(child.items ?? []).map((item) => (
            <View key={item.id} className="detail-row">
              <Text className="text-muted">
                {item.name}
                {item.note ? ` · ${item.note}` : ''}
              </Text>
              <View className="action-row-inline">
                <Text className="text-muted">¥{money(item.amount)}</Text>
                {child.status !== 'PAID' ? (
                  <Text
                    className="link-text"
                    onClick={() =>
                      handleEditItem({
                        id: item.id,
                        billId: child.id,
                        name: item.name,
                        amount: Number(item.amount),
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
              onClick={() => handleUtilityReading(child.id)}
            >
              录入本期水电
            </Button>
          ) : null}
        </View>
      ))}

      {(group.payments ?? []).length ? (
        <View className="detail-panel">
          <Text className="field-label">收款记录</Text>
          {(group.payments ?? []).map((payment) => (
            <View key={payment.id} className="detail-row">
              <Text className="text-muted">
                {day(payment.paidAt)} · {payment.method}
              </Text>
              <Text className="card-stat">¥{money(payment.amount)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text className="text-muted">暂无收款记录</Text>
      )}
    </View>
  );
}
