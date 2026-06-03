import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { EmptyState, Input } from '../../../components/ui';
import { BillCard } from './BillCard';
import { statusLabels } from '../constants';
import { sortBillGroupsForList } from '../utils';
import { useAppSession } from '../../../context/AppSessionContext';
import { deleteBill } from '../../../api/bills';
import type { BillGroup } from '../utils';
import type { BillStatus } from '../../../types/domain';

interface AllTabProps {
  groups: BillGroup[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: BillStatus | '';
  onStatusFilterChange: (status: BillStatus | '') => void;
}

export function AllTab({
  groups,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: AllTabProps) {
  const { currentOrgId } = useAppSession();
  const sorted = sortBillGroupsForList(groups);

  const handleDelete = async (group: BillGroup) => {
    if (!currentOrgId) return;
    const res = await Taro.showModal({
      title: '删除账单组',
      content: `将删除该组 ${group.bills.length} 笔账单，删除后不可恢复，是否确认？`,
      confirmText: '确认删除',
      confirmColor: '#ff4d4f',
    });
    if (!res.confirm) return;
    try {
      await Promise.all(group.bills.map((b) => deleteBill(currentOrgId, b.id)));
      Taro.showToast({ title: '账单组已删除', icon: 'success' });
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
          [
            '',
            'UNPAID',
            'PARTIAL_PAID',
            'PAID',
            'FAILED',
            'VOID',
            'REFUNDED',
          ] as const
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
      {sorted.map((group) => (
        <BillCard
          key={group.id}
          group={group}
          onClick={() =>
            Taro.navigateTo({
              url: `/pages/bills/monthly-detail?id=${group.id}`,
            })
          }
          showDelete={
            group.status !== 'PAID' &&
            group.status !== 'VOID' &&
            group.status !== 'REFUNDED'
          }
          onDelete={() => handleDelete(group)}
        />
      ))}
    </>
  );
}
