// PAGE-205: 租客交易流水页面
import { useState, useEffect, useCallback } from 'react';
import { Table, Tag } from 'antd';
import { getTenantAccountTransactions } from '@/api/tenants';
import type { AccountTransaction } from '@/types/domain';
import { money, day } from '@/utils/format';

interface TenantTransactionSectionProps {
  tenantId: string;
  currentOrgId: string;
  reloadKey?: number;
}

const transactionTypeLabels: Record<string, string> = {
  PAYMENT: '收款',
  CHARGE: '扣款',
  REFUND: '退款',
  ADJUSTMENT: '调账',
};

const transactionTypeColors: Record<string, string> = {
  PAYMENT: 'success',
  CHARGE: 'error',
  REFUND: 'warning',
  ADJUSTMENT: 'processing',
};

export default function TenantTransactionSection({
  tenantId,
  currentOrgId,
  reloadKey,
}: TenantTransactionSectionProps) {
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const loadTransactions = useCallback(
    async (targetPage: number) => {
      try {
        const data = await getTenantAccountTransactions(
          currentOrgId,
          tenantId,
          targetPage,
          10
        );
        setTransactions(data.items);
        setTotal(data.total);
        setPage(targetPage);
      } catch {
        // silently fail; parent handles general loading state
      }
    },
    [currentOrgId, tenantId]
  );

  useEffect(() => {
    loadTransactions(1);
  }, [loadTransactions, reloadKey]);

  const columns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => (
        <Tag color={transactionTypeColors[v] || 'default'}>
          {transactionTypeLabels[v] || v}
        </Tag>
      ),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (v: string | number) => money(v),
    },
    {
      title: '变动后余额',
      dataIndex: 'balanceAfter',
      key: 'balanceAfter',
      render: (v: string | number) => money(v),
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      render: (v?: string) => v || '-',
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => day(v),
    },
  ];

  return (
    <Table
      dataSource={transactions}
      columns={columns}
      rowKey="id"
      pagination={{
        current: page,
        pageSize: 10,
        total,
        onChange: loadTransactions,
      }}
    />
  );
}
