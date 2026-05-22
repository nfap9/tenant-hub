import { View, Text } from '@tarojs/components';
import { Button, Badge } from '../../../components/ui';
import { day } from '../../../utils/format';
import { statusLabels, toneForBillStatus } from '../constants';
import type { Bill } from '../../../types/domain';

interface PendingBillCardProps {
  bill: Bill;
  onRetry: () => void;
  onUtilityReading: () => void;
}

export function PendingBillCard({
  bill,
  onRetry,
  onUtilityReading,
}: PendingBillCardProps) {
  return (
    <View key={bill.id} className="bill-card">
      <View className="bill-card-header">
        <View>
          <Text className="card-title">
            {bill.lease?.tenantName ?? '租客'} ·{' '}
            {bill.lease?.room?.roomNo ?? '房间'}
          </Text>
          <Text className="text-muted">
            {day(bill.periodStart)} 至 {day(bill.periodEnd)}
          </Text>
        </View>
        <Badge tone={toneForBillStatus(bill.status)}>
          {statusLabels[bill.status]}
        </Badge>
      </View>
      <Text className="danger-text">
        {bill.failureReason ?? '需要补录或修正水电读数'}
      </Text>
      <View className="action-row-inline">
        <Button variant="secondary" size="small" onClick={onRetry}>
          重新出账
        </Button>
        <Button size="small" onClick={onUtilityReading}>
          录入本期水电
        </Button>
      </View>
    </View>
  );
}
