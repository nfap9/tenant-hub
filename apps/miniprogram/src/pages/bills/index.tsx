import { useState, useMemo, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { useAppSession } from '../../context/AppSessionContext';
import { retryBilling } from '../../api/bills';
import { getBills } from '../../api/bills';
import { getRooms } from '../../api/rooms';
import { Button, Card } from '../../components/ui';
import { NoOrganization } from '../../components/NoOrganization';
import { money } from '../../utils/format';
import { remainingAmount } from './utils';
import { UnpaidTab } from './components/UnpaidTab';
import { PendingTab } from './components/PendingTab';
import { AllTab } from './components/AllTab';
import { groupBills } from './utils';
import type { Bill, BillStatus, Room } from '../../types/domain';
import type { BillGroup } from './utils';
import './index.scss';

export default function BillsPage() {
  const { currentOrgId } = useAppSession();
  const [tab, setTab] = useState<'unpaid' | 'pending' | 'all'>('unpaid');
  const [billGroups, setBillGroups] = useState<BillGroup[]>([]);
  const [reviewBills, setReviewBills] = useState<Bill[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BillStatus | ''>('');

  const unpaidGroups = useMemo(
    () =>
      billGroups.filter(
        (g) => g.status === 'UNPAID' || g.status === 'PARTIAL_PAID'
      ),
    [billGroups]
  );
  const unpaidTotal = useMemo(
    () =>
      unpaidGroups.reduce((sum, g) => sum + (g.totalAmount - g.paidAmount), 0),
    [unpaidGroups]
  );

  const filteredAllGroups = useMemo(() => {
    let result = [...billGroups];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (g) =>
          g.tenantName?.toLowerCase().includes(q) ||
          g.lease?.room?.roomNo?.toLowerCase().includes(q) ||
          g.tenantPhone?.includes(q)
      );
    }
    if (statusFilter) result = result.filter((g) => g.status === statusFilter);
    return result;
  }, [billGroups, searchQuery, statusFilter]);

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const [allBills, failedBills, billingBills, nextRooms] =
        await Promise.all([
          getBills(currentOrgId),
          getBills(currentOrgId, 'FAILED'),
          getBills(currentOrgId, 'BILLING'),
          getRooms(currentOrgId),
        ]);
      const postpaidReviewBills = [...failedBills, ...billingBills].filter(
        (bill) => bill.mode === 'POSTPAID'
      );
      setBillGroups(groupBills(allBills));
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
    if (unpaidGroups.length === 0) {
      Taro.showToast({ title: '暂无待收账单', icon: 'none' });
      return;
    }
    Taro.navigateTo({ url: '/pages/bills/payment' });
  };

  const retryBill = async (bill: Bill) => {
    if (!currentOrgId) return;
    try {
      await retryBilling(currentOrgId, bill.id);
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
              <Text className="stat-value">{unpaidGroups.length}</Text>
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
              <Text className="stat-value">{billGroups.length}</Text>
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
        <UnpaidTab groups={unpaidGroups} />
      ) : tab === 'pending' ? (
        <PendingTab bills={reviewBills} onRetry={retryBill} />
      ) : (
        <AllTab
          groups={filteredAllGroups}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />
      )}
    </View>
  );
}
