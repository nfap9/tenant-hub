import { useState, useCallback } from 'react';
import { ScrollView, View, Text } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import {
  useAppSession,
  useHasPermission,
} from '../../context/AppSessionContext';
import { getDeposit, createDepositPayment } from '../../api/deposits';
import { Button, Card, Badge, Input } from '../../components/ui';
import { money } from '../../utils/format';
import type { Deposit, DepositStatus } from '../../types/domain';
import './index.scss';

const statusLabels: Record<DepositStatus, string> = {
  UNPAID: '未收取',
  PAID: '已收取',
  PARTIAL_REFUNDED: '部分退还',
  FULLY_REFUNDED: '已全额退还',
  DEDUCTED: '已扣款',
};

const statusToneMap: Record<DepositStatus, string> = {
  UNPAID: 'warning',
  PAID: 'success',
  PARTIAL_REFUNDED: 'primary',
  FULLY_REFUNDED: 'neutral',
  DEDUCTED: 'danger',
};

const paymentTypeOptions = [
  { label: '收取', value: 'COLLECT' },
  { label: '退还', value: 'REFUND' },
  { label: '扣款', value: 'DEDUCT' },
];

export default function DepositDetailPage() {
  const { currentOrgId } = useAppSession();
  const canManageDeposit = useHasPermission('deposit:manage');
  const { params } = useRouter();
  const depositId = params.id;

  const [deposit, setDeposit] = useState<Deposit | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentType, setPaymentType] = useState('COLLECT');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOrgId || !depositId) return;
    setLoading(true);
    try {
      const data = await getDeposit(currentOrgId, depositId);
      setDeposit(data);
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '加载押金详情失败',
        icon: 'none',
      });
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, depositId]);

  useDidShow(() => {
    loadData();
  });

  const handlePayment = async () => {
    if (!currentOrgId || !depositId) return;
    if (!paymentAmount || !paymentMethod) {
      Taro.showToast({ title: '请填写金额和方式', icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      await createDepositPayment(currentOrgId, depositId, {
        type: paymentType as 'COLLECT' | 'REFUND' | 'DEDUCT',
        amount: Number(paymentAmount),
        method: paymentMethod,
        note: paymentNote.trim() || undefined,
      });
      Taro.showToast({ title: '操作成功', icon: 'success' });
      setShowPaymentForm(false);
      setPaymentAmount('');
      setPaymentMethod('');
      setPaymentNote('');
      loadData();
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '操作失败',
        icon: 'none',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!deposit && !loading) {
    return (
      <View className="page-container">
        <Text className="text-muted">押金记录不存在</Text>
      </View>
    );
  }

  const balance = deposit
    ? Number(deposit.paidAmount) -
      Number(deposit.refundedAmount) -
      Number(deposit.deductedAmount)
    : 0;

  return (
    <ScrollView className="page-container" scrollY>
      <View className="sub-page-header">
        <Button
          className="page-back-button"
          variant="ghost"
          size="small"
          onClick={() => Taro.navigateBack()}
        >
          ‹ 返回
        </Button>
      </View>

      {deposit && (
        <>
          <Card
            title="押金信息"
            headerAction={
              canManageDeposit ? (
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => setShowPaymentForm(!showPaymentForm)}
                >
                  {showPaymentForm ? '取消' : '登记'}
                </Button>
              ) : undefined
            }
          >
            <View className="detail-panel">
              <View className="detail-row">
                <Text className="text-muted">租客</Text>
                <Text>
                  {deposit.lease?.tenantName} · {deposit.lease?.room?.roomNo}
                </Text>
              </View>
              <View className="detail-row">
                <Text className="text-muted">状态</Text>
                <Badge tone={statusToneMap[deposit.status] as any}>
                  {statusLabels[deposit.status]}
                </Badge>
              </View>
              <View className="detail-row">
                <Text className="text-muted">约定押金</Text>
                <Text className="card-stat">¥{money(deposit.amount)}</Text>
              </View>
              <View className="detail-row">
                <Text className="text-muted">已收</Text>
                <Text>¥{money(deposit.paidAmount)}</Text>
              </View>
              <View className="detail-row">
                <Text className="text-muted">已退</Text>
                <Text>¥{money(deposit.refundedAmount)}</Text>
              </View>
              <View className="detail-row">
                <Text className="text-muted">已扣</Text>
                <Text>¥{money(deposit.deductedAmount)}</Text>
              </View>
              <View className="detail-row">
                <Text className="text-muted">可退余额</Text>
                <Text className="card-stat">¥{money(balance)}</Text>
              </View>
            </View>
          </Card>

          {showPaymentForm && canManageDeposit && (
            <Card title="登记收退">
              <View className="detail-panel">
                <View className="segment">
                  {paymentTypeOptions.map((option) => (
                    <View
                      key={option.value}
                      className={`segment-item ${paymentType === option.value ? 'segment-item--active' : ''}`}
                      onClick={() => setPaymentType(option.value)}
                    >
                      <Text
                        className={`segment-text ${paymentType === option.value ? 'segment-text--active' : ''}`}
                      >
                        {option.label}
                      </Text>
                    </View>
                  ))}
                </View>
                <Input
                  label="金额"
                  value={paymentAmount}
                  onChange={setPaymentAmount}
                  type="digit"
                  placeholder="请输入金额"
                />
                <Input
                  label="方式"
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  placeholder="例如 线下收款、微信转账"
                />
                <Input
                  label="备注"
                  value={paymentNote}
                  onChange={setPaymentNote}
                  placeholder="可选"
                />
                <Button
                  loading={submitting}
                  disabled={submitting}
                  onClick={handlePayment}
                >
                  确认
                </Button>
              </View>
            </Card>
          )}

          <Card title="收退流水">
            {deposit.lease?.bills?.flatMap((bill) =>
              bill.payments?.map((payment) => (
                <View key={payment.id} className="detail-row">
                  <View>
                    <Text className="text-muted">
                      {payment.type === 'RECEIVE'
                        ? '收取'
                        : payment.type === 'REFUND'
                          ? '退还'
                          : '扣款'}
                      · {payment.method}
                    </Text>
                    <Text className="text-muted">
                      {payment.paidAt.slice(0, 16).replace('T', ' ')}
                    </Text>
                  </View>
                  <Text className="card-stat">¥{money(payment.amount)}</Text>
                </View>
              ))
            ).length === 0 &&
              (!deposit.bill?.payments ||
                deposit.bill.payments.length === 0) && (
                <Text className="text-muted">暂无流水</Text>
              )}

            {deposit.lease?.bills?.flatMap((bill) =>
              bill.payments?.map((payment) => (
                <View key={payment.id} className="detail-row">
                  <View>
                    <Text className="text-muted">
                      {payment.type === 'RECEIVE'
                        ? '收取'
                        : payment.type === 'REFUND'
                          ? '退还'
                          : '扣款'}
                      · {payment.method}
                    </Text>
                    <Text className="text-muted">
                      {payment.paidAt.slice(0, 16).replace('T', ' ')}
                    </Text>
                  </View>
                  <Text className="card-stat">¥{money(payment.amount)}</Text>
                </View>
              ))
            )}

            {deposit.bill?.payments?.map((payment) => (
              <View key={payment.id} className="detail-row">
                <View>
                  <Text className="text-muted">
                    {payment.type === 'RECEIVE'
                      ? '收取'
                      : payment.type === 'REFUND'
                        ? '退还'
                        : '扣款'}
                    · {payment.method}
                  </Text>
                  <Text className="text-muted">
                    {payment.paidAt.slice(0, 16).replace('T', ' ')}
                  </Text>
                </View>
                <Text className="card-stat">¥{money(payment.amount)}</Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </ScrollView>
  );
}
