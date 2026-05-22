import Taro from '@tarojs/taro';
import { EmptyState } from '../../../components/ui';
import { BillCard } from './BillCard';
import { sortMonthlyBillsForList } from '../utils';
import type { MonthlyBill } from '../../../types/domain';

interface UnpaidTabProps {
  bills: MonthlyBill[];
}

export function UnpaidTab({ bills }: UnpaidTabProps) {
  const sorted = sortMonthlyBillsForList(bills);
  return (
    <>
      {bills.length === 0 ? (
        <EmptyState
          icon="bill"
          title="暂无待支付账单"
          subtitle="所有账单均已结清或暂无账单"
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
        />
      ))}
    </>
  );
}
