// PAGE-305: 退款审批页面
import { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, Button, message, Spin, Modal } from 'antd';
import {
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { money } from '@/utils/format';
import styles from './RefundsPage.module.scss';

type RefundRecord = {
  id: string;
  tenantName: string;
  tenantPhone: string;
  type: 'DEPOSIT' | 'PREPAID' | 'OVERPAY';
  amount: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  createdAt: string;
  approvedAt?: string;
  approver?: string;
};

const statusLabels: Record<string, string> = {
  PENDING: '待审批',
  APPROVED: '已批准',
  REJECTED: '已拒绝',
  COMPLETED: '已完成',
};

const statusColors: Record<string, string> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  COMPLETED: 'default',
};

const typeLabels: Record<string, string> = {
  DEPOSIT: '退押金',
  PREPAID: '退预付款',
  OVERPAY: '退多收款',
};

export default function RefundApprovalPage() {
  const { currentOrgId } = useAppSession();
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      setRefunds([]);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = (record: RefundRecord) => {
    Modal.confirm({
      title: '审批退款',
      content: `确认批准 ${record.tenantName} 的 ¥${money(record.amount)} 退款申请吗？`,
      onOk: async () => {
        message.success('已批准（演示）');
        loadData();
      },
    });
  };

  const handleReject = (record: RefundRecord) => {
    Modal.confirm({
      title: '拒绝退款',
      content: `确认拒绝 ${record.tenantName} 的退款申请吗？`,
      okButtonProps: { danger: true },
      onOk: async () => {
        message.success('已拒绝（演示）');
        loadData();
      },
    });
  };

  const columns = [
    {
      title: '租客',
      key: 'tenant',
      render: (_: unknown, record: RefundRecord) => (
        <div>
          <div>{record.tenantName}</div>
          <div className="text-muted">{record.tenantPhone}</div>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => <Tag>{typeLabels[v] || v}</Tag>,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (v: number) => <span className={styles.amount}>¥{money(v)}</span>,
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      render: (v: string) => v || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => (
        <Tag color={statusColors[v]}>{statusLabels[v] || v}</Tag>
      ),
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: RefundRecord) =>
        record.status === 'PENDING' ? (
          <div className={styles.actions}>
            <Button
              type="link"
              icon={<CheckCircleOutlined />}
              onClick={() => handleApprove(record)}
            >
              批准
            </Button>
            <Button
              type="link"
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => handleReject(record)}
            >
              拒绝
            </Button>
          </div>
        ) : (
          '-'
        ),
    },
  ];

  return (
    <div className="page-content">
      <PageHeader
        back="/refunds"
        breadcrumb={[
          { label: '退款管理', path: '/refunds' },
          { label: '审批退款' },
        ]}
        actions={
          <Button
            icon={<ReloadOutlined />}
            onClick={loadData}
            loading={loading}
          >
            刷新
          </Button>
        }
      />

      <Spin spinning={loading}>
        {refunds.length === 0 ? (
          <EmptyState
            title="暂无待审批退款"
            description="所有退款申请均已处理完毕"
          />
        ) : (
          <Card>
            <Table
              rowKey="id"
              dataSource={refunds}
              columns={columns}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        )}
      </Spin>
    </div>
  );
}
