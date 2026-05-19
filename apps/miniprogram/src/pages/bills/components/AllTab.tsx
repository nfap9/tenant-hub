import { View, Text } from '@tarojs/components';
import { EmptyState, Input } from '../../../components/ui';
import { BillCard } from './BillCard';
import { statusLabels } from '../constants';
import { sortMonthlyBillsForList } from '../utils';
import type { MonthlyBill, BillStatus } from '../../../types/domain';

interface AllTabProps {
  bills: MonthlyBill[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: BillStatus | "";
  onStatusFilterChange: (status: BillStatus | "") => void;
  onDetail: (bill: MonthlyBill) => void;
  onDelete: (bill: MonthlyBill) => void;
}

export function AllTab({
  bills, searchQuery, onSearchChange, statusFilter, onStatusFilterChange,
  onDetail, onDelete
}: AllTabProps) {
  const sorted = sortMonthlyBillsForList(bills);
  return (
    <>
      <Input label="搜索账单" placeholder="租客姓名、房间号或手机号" value={searchQuery} onChange={onSearchChange} />
      <View className="segment">
        {(["", "UNPAID", "PARTIAL_PAID", "PAID", "FAILED", "VOID"] as const).map((status) => (
          <View key={status || "all"} className={`segment-item ${statusFilter === status ? 'segment-item--active' : ''}`} onClick={() => onStatusFilterChange(status)}>
            <Text className={`segment-text ${statusFilter === status ? 'segment-text--active' : ''}`}>{status ? statusLabels[status] : "全部状态"}</Text>
          </View>
        ))}
      </View>
      {sorted.length === 0 ? (
        <EmptyState icon="bill" title="未找到账单" subtitle="尝试调整搜索条件或过滤状态" />
      ) : null}
      {sorted.map((bill) => (
        <BillCard
          key={bill.id}
          bill={bill}
          onClick={() => onDetail(bill)}
          showDelete={bill.status !== "PAID"}
          onDelete={() => onDelete(bill)}
        />
      ))}
    </>
  );
}
