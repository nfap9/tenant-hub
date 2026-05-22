import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { EmptyState, Input } from '../../../components/ui';
import { BillCard } from './BillCard';
import { statusLabels } from '../constants';
import { sortMonthlyBillsForList } from '../utils';
import { useAppSession } from '../../../context/AppSessionContext';
import { apiClient } from '../../../api/client';
import type { MonthlyBill, BillStatus } from '../../../types/domain';

interface AllTabProps {
  bills: MonthlyBill[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: BillStatus | '';
  onStatusFilterChange: (status: BillStatus | '') => void;
}

export function AllTab({
  bills,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: AllTabProps) {
  const { currentOrgId } = useAppSession();
  const sorted = sortMonthlyBillsForList(bills);

  const handleDelete = async (bill: MonthlyBill) => {
    if (!currentOrgId) return;
    const res = await Taro.showModal({
      title: '删除月度账单',
      content: '删除后不可恢复，是否确认？',
      confirmText: '确认删除',
      confirmColor: '#ff4d4f',
    });
    if (!res.confirm) return;
    try {
      await apiClient(`/bills/monthly/${bill.id}`, {
        method: 'DELETE',
        organizationId: currentOrgId,
      });
      Taro.showToast({ title: '月度账单已删除', icon: 'success' });
      // Parent page will refresh on didShow
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '删除失败',
        icon: 'none',
      });
    }
  };

  return (
    <>
      <Input
        label="搜索账单"
        placeholder="租客姓名、房间号或手机号"
        value={searchQuery}
        onChange={onSearchChange}
      />
      <View className="segment">
        {(
          ['', 'UNPAID', 'PARTIAL_PAID', 'PAID', 'FAILED', 'VOID'] as const
        ).map((status) => (
          <View
            key={status || 'all'}
            className={`segment-item ${statusFilter === status ? 'segment-item--active' : ''}`}
            onClick={() => onStatusFilterChange(status)}
          >
            <Text
              className={`segment-text ${statusFilter === status ? 'segment-text--active' : ''}`}
            >
              {status ? statusLabels[status] : '全部状态'}
            </Text>
          </View>
        ))}
      </View>
      {sorted.length === 0 ? (
        <EmptyState
          icon="bill"
          title="未找到账单"
          subtitle="尝试调整搜索条件或过滤状态"
        />
      ) : null}
      {sorted.map((bill) => (
        <BillCard
          key={bill.id}
          bill={bill}
          onClick={() =>
            Taro.navigateTo({
              url: `/pages/bills/monthly-detail?id=${bill.id}`,
            })
          }
          showDelete={bill.status !== 'PAID'}
          onDelete={() => handleDelete(bill)}
        />
      ))}
    </>
  );
}
