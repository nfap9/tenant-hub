import { useState, useMemo, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { useAppSession } from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { getApiBaseUrl } from '../../constants/config';
import { Button, Card } from '../../components/ui';
import { NoOrganization } from '../../components/NoOrganization';
import { money } from '../../utils/format';
import { remainingAmount } from './utils';
import { UnpaidTab } from './components/UnpaidTab';
import { PendingTab } from './components/PendingTab';
import { AllTab } from './components/AllTab';
import type { Bill, BillStatus, MonthlyBill, Room } from '../../types/domain';
import './index.scss';

export default function BillsPage() {
  const { currentOrgId } = useAppSession();
  const [tab, setTab] = useState<'unpaid' | 'pending' | 'all'>('unpaid');
  const [monthlyBills, setMonthlyBills] = useState<MonthlyBill[]>([]);
  const [reviewBills, setReviewBills] = useState<Bill[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BillStatus | ''>('');

  const unpaidMonthlyBills = useMemo(
    () =>
      monthlyBills.filter(
        (bill) => bill.status === 'UNPAID' || bill.status === 'PARTIAL_PAID'
      ),
    [monthlyBills]
  );
  const unpaidTotal = useMemo(
    () =>
      unpaidMonthlyBills.reduce((sum, bill) => sum + remainingAmount(bill), 0),
    [unpaidMonthlyBills]
  );

  const filteredAllBills = useMemo(() => {
    let result = [...monthlyBills];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (bill) =>
          bill.tenantName?.toLowerCase().includes(q) ||
          bill.lease?.room?.roomNo?.toLowerCase().includes(q) ||
          bill.lease?.tenantPhone?.includes(q)
      );
    }
    if (statusFilter)
      result = result.filter((bill) => bill.status === statusFilter);
    return result;
  }, [monthlyBills, searchQuery, statusFilter]);

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const nextMonthlyBills = await apiClient<MonthlyBill[]>(
        '/bills/monthly',
        { organizationId: currentOrgId }
      );
      const [failedBills, billingBills, nextRooms] = await Promise.all([
        apiClient<Bill[]>('/bills?status=FAILED', {
          organizationId: currentOrgId,
        }),
        apiClient<Bill[]>('/bills?status=BILLING', {
          organizationId: currentOrgId,
        }),
        apiClient<Room[]>('/apartments/rooms', {
          organizationId: currentOrgId,
        }),
      ]);
      const postpaidReviewBills = [...failedBills, ...billingBills].filter(
        (bill) => bill.mode === 'POSTPAID'
      );
      setMonthlyBills(nextMonthlyBills);
      setReviewBills(postpaidReviewBills);
      setRooms(nextRooms);
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '账单加载失败',
        icon: 'none',
      });
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

  const openPayment = () => {
    if (unpaidMonthlyBills.length === 0) {
      Taro.showToast({ title: '暂无待收账单', icon: 'none' });
      return;
    }
    Taro.navigateTo({ url: '/pages/bills/payment' });
  };

  const retryBill = async (bill: Bill) => {
    if (!currentOrgId) return;
    try {
      await apiClient(`/bills/${bill.id}/retry-billing`, {
        method: 'POST',
        organizationId: currentOrgId,
      });
      Taro.showToast({ title: '已重新尝试出账', icon: 'success' });
      await loadData();
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '重试失败',
        icon: 'none',
      });
    }
  };

  const exportUtilityCsv = async () => {
    if (!currentOrgId) return;
    Taro.navigateTo({ url: '/pages/bills/utility-export' });
  };

  const deleteMonthlyBill = async (id: string) => {
    if (!currentOrgId) return;
    const res = await Taro.showModal({
      title: '删除月度账单',
      content: '删除后不可恢复，是否确认？',
      confirmText: '确认删除',
      confirmColor: '#ff4d4f',
    });
    if (!res.confirm) return;
    try {
      await apiClient(`/bills/monthly/${id}`, {
        method: 'DELETE',
        organizationId: currentOrgId,
      });
      Taro.showToast({ title: '月度账单已删除', icon: 'success' });
      await loadData();
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '删除失败',
        icon: 'none',
      });
    }
  };

  if (!currentOrgId) {
    return <NoOrganization />;
  }

  return (
    <View className="page-container">
      <View className="stat-row">
        {tab === 'unpaid' ? (
          <>
            <Card className="stat-card">
              <Text className="stat-label">待支付账单</Text>
              <Text className="stat-value">{unpaidMonthlyBills.length}</Text>
            </Card>
            <Card className="stat-card">
              <Text className="stat-label">待收金额</Text>
              <Text className="stat-value">¥{money(unpaidTotal)}</Text>
            </Card>
          </>
        ) : tab === 'pending' ? (
          <Card className="stat-card">
            <Text className="stat-label">待处理账单</Text>
            <Text className="stat-value">{reviewBills.length}</Text>
          </Card>
        ) : (
          <>
            <Card className="stat-card">
              <Text className="stat-label">全部账单</Text>
              <Text className="stat-value">{monthlyBills.length}</Text>
            </Card>
            <Card className="stat-card">
              <Text className="stat-label">待收金额</Text>
              <Text className="stat-value">¥{money(unpaidTotal)}</Text>
            </Card>
          </>
        )}
      </View>

      <View className="segment">
        {(
          [
            { key: 'unpaid', label: '待支付' },
            { key: 'pending', label: '待处理' },
            { key: 'all', label: '全部' },
          ] as const
        ).map(({ key, label }) => (
          <View
            key={key}
            className={`segment-item ${tab === key ? 'segment-item--active' : ''}`}
            onClick={() => setTab(key)}
          >
            <Text
              className={`segment-text ${tab === key ? 'segment-text--active' : ''}`}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>

      <View className="section-header">
        <View className="action-row-inline">
          {tab === 'unpaid' ? (
            <Button variant="secondary" size="small" onClick={openPayment}>
              登记收款
            </Button>
          ) : null}
          {tab === 'pending' ? (
            <>
              <Button
                size="small"
                onClick={() => Taro.navigateTo({ url: '/pages/bills/reading' })}
              >
                录入读数
              </Button>
              <Button
                variant="secondary"
                size="small"
                onClick={exportUtilityCsv}
              >
                导出
              </Button>
              <Button
                variant="secondary"
                size="small"
                onClick={() =>
                  Taro.navigateTo({ url: '/pages/bills/utility-import' })
                }
              >
                导入
              </Button>
            </>
          ) : null}
          <Button
            variant="ghost"
            size="small"
            loading={loading}
            disabled={loading}
            onClick={loadData}
          >
            {loading ? '刷新中' : '刷新'}
          </Button>
        </View>
      </View>

      {tab === 'unpaid' ? (
        <UnpaidTab bills={unpaidMonthlyBills} />
      ) : tab === 'pending' ? (
        <PendingTab bills={reviewBills} onRetry={retryBill} />
      ) : (
        <AllTab
          bills={filteredAllBills}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />
      )}
    </View>
  );
}
