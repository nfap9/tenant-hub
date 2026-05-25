import { useState, useEffect, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { usePullDownRefresh } from '@tarojs/taro';
import { useAppSession } from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { Card, EmptyState, Badge } from '../../components/ui';
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

export default function DepositsPage() {
  const { currentOrgId } = useAppSession();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const data = await apiClient<Deposit[]>('/deposits', {
        organizationId: currentOrgId,
      });
      setDeposits(data);
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  usePullDownRefresh(() => {
    loadData().finally(() => Taro.stopPullDownRefresh());
  });

  return (
    <View className="page-container">
      <Card title={`押金记录 (${deposits.length})`}>
        {deposits.length === 0 ? (
          <EmptyState
            emoji="💰"
            title="暂无押金记录"
            subtitle="签约租约后将自动生成押金记录"
          />
        ) : (
          <View className="deposit-list">
            {deposits.map((deposit) => (
              <View key={deposit.id} className="deposit-item">
                <View className="deposit-header">
                  <Text className="deposit-room">
                    {deposit.lease?.room?.roomNo || '-'}
                  </Text>
                  <Badge tone={statusToneMap[deposit.status] as any}>
                    {statusLabels[deposit.status]}
                  </Badge>
                </View>
                <View className="deposit-body">
                  <View className="deposit-row">
                    <Text className="text-muted">租客</Text>
                    <Text>{deposit.lease?.tenantName}</Text>
                  </View>
                  <View className="deposit-row">
                    <Text className="text-muted">约定押金</Text>
                    <Text>¥{money(deposit.amount)}</Text>
                  </View>
                  <View className="deposit-row">
                    <Text className="text-muted">已收</Text>
                    <Text>¥{money(deposit.paidAmount)}</Text>
                  </View>
                  {(Number(deposit.refundedAmount) > 0 ||
                    Number(deposit.deductedAmount) > 0) && (
                    <View className="deposit-row">
                      <Text className="text-muted">已退/扣</Text>
                      <Text>
                        ¥{money(deposit.refundedAmount)} / ¥
                        {money(deposit.deductedAmount)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>
    </View>
  );
}
