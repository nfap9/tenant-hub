import { Table } from 'antd';
import { money, day } from '@/utils/format';
import { billItemTypeText } from '../constants';
import type { BillGroup } from '../utils';

interface BillGroupItemsTableProps {
  group: BillGroup;
}

export default function BillGroupItemsTable({
  group,
}: BillGroupItemsTableProps) {
  const itemRows = group.bills.flatMap((bill) =>
    (bill.items ?? []).map((item) => ({ item, bill }))
  );

  return (
    <Table
      rowKey={(record) => `${record.bill.id}_${record.item.id}`}
      dataSource={itemRows}
      pagination={false}
      size="small"
      columns={[
        {
          title: '费用项目类型',
          render: (_: unknown, { item, bill }) => (
            <span>
              {billItemTypeText(item.category, item.name)}
              {bill.status === 'PENDING' &&
                item.category === 'UTILITY' &&
                Number(item.amount) === 0 && (
                  <span style={{ color: 'var(--th-foreground-muted)' }}>
                    {' '}
                    （待录入读数）
                  </span>
                )}
            </span>
          ),
        },
        {
          title: '账期',
          render: (_: unknown, { item }) => (
            <span>
              {day(item.periodStart)} ~ {day(item.periodEnd)}
            </span>
          ),
        },
        {
          title: '金额',
          render: (_: unknown, { item, bill }) => (
            <span>
              {bill.status === 'PENDING' &&
              item.category === 'UTILITY' &&
              Number(item.amount) === 0
                ? '待计算'
                : `¥${money(item.amount)}`}
            </span>
          ),
        },
      ]}
    />
  );
}
