import Taro from '@tarojs/taro';
import { EmptyState } from '../../../components/ui';
import { BillCard } from './BillCard';
import { sortBillGroupsForList } from '../utils';
import type { BillGroup } from '../utils';

interface UnpaidTabProps {
  groups: BillGroup[];
}

export function UnpaidTab({ groups }: UnpaidTabProps) {
  const sorted = sortBillGroupsForList(groups);
  return (
    <>
      {groups.length === 0 ? (
        <EmptyState
          icon="bill"
          title="暂无待支付账单"
          subtitle="所有账单均已结清或暂无账单"
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
        />
      ))}
    </>
  );
}
