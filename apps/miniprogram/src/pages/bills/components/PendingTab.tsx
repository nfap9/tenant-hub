import Taro from '@tarojs/taro';
import { EmptyState } from '../../../components/ui';
import { PendingBillCard } from './PendingBillCard';
import type { Bill } from '../../../types/domain';

interface PendingTabProps {
  bills: Bill[];
  onRetry: (bill: Bill) => void;
}

export function PendingTab({ bills, onRetry }: PendingTabProps) {
  return (
    <>
      {bills.length === 0 ? (
        <EmptyState icon="check" title="没有待处理账单" subtitle="暂无出账失败的水电账单" />
      ) : null}
      {bills.map((bill) => (
        <PendingBillCard
          key={bill.id}
          bill={bill}
          onRetry={() => onRetry(bill)}
          onUtilityReading={() => Taro.navigateTo({ url: `/pages/bills/utility?billId=${bill.id}` })}
        />
      ))}
    </>
  );
}
