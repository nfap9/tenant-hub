import { View, Text } from '@tarojs/components';
import { Badge } from '../../../components/ui';
import { money } from '../../../utils/format';
import { statusLabels, toneForBillStatus } from '../constants';
import { getMonthlyBillCardSummary } from '../utils';
import type { MonthlyBill } from '../../../types/domain';

interface BillCardProps {
  bill: MonthlyBill;
  onClick: () => void;
  showDelete?: boolean;
  onDelete?: () => void;
}

export function BillCard({
  bill,
  onClick,
  showDelete,
  onDelete,
}: BillCardProps) {
  const summary = getMonthlyBillCardSummary(bill);
  return (
    <View key={bill.id} className="bill-card" onClick={onClick}>
      <View className="bill-card-header">
        <View>
          <Text className="card-title">{summary.title}</Text>
          <Text className="text-muted">{summary.meta}</Text>
        </View>
        <Badge tone={toneForBillStatus(bill.status)}>
          {statusLabels[bill.status]}
        </Badge>
      </View>
      <View className="bill-amount-row">
        <Text className="bill-amount">¥{money(summary.totalAmount)}</Text>
        <View className="bill-summary-aside">
          <Text className="text-muted">
            剩余 ¥{money(summary.remainingAmount)}
          </Text>
          <Text className="text-muted">已收 ¥{money(summary.paidAmount)}</Text>
        </View>
      </View>
      <View className="bill-footer">
        <Text className="field-label">{summary.detailCountText}</Text>
        <View className="action-row-inline">
          {showDelete ? (
            <Text
              className="danger-text"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.();
              }}
            >
              删除
            </Text>
          ) : null}
          <Text className="link-text">查看详情</Text>
        </View>
      </View>
    </View>
  );
}
