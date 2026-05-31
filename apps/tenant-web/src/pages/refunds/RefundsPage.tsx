// PAGE-304: 退款申请页面
import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  message,
  Spin,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { money } from '@/utils/format';
import { getRefunds, createRefund, type Refund } from '@/api/refunds';
import { getTenants } from '@/api/tenants';
import type { Tenant } from '@/types/domain';
import styles from './RefundsPage.module.scss';

type RefundRecord = Refund;

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

export default function RefundsPage() {
  const { currentOrgId } = useAppSession();
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const [data, tenantList] = await Promise.all([
        getRefunds(),
        getTenants(currentOrgId),
      ]);
      setRefunds(data);
      setTenants(tenantList);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (values: {
    tenantId: string;
    type: 'DEPOSIT' | 'PREPAID' | 'OVERPAY';
    amount: number;
    reason: string;
  }) => {
    if (!currentOrgId) return;
    try {
      await createRefund(values);
      message.success('退款申请已提交');
      setModalOpen(false);
      form.resetFields();
      loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '提交失败');
    }
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
  ];

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[{ label: '退款管理' }]}
        actions={
          <>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadData}
              loading={loading}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                form.resetFields();
                setModalOpen(true);
              }}
            >
              申请退款
            </Button>
          </>
        }
      />

      <Spin spinning={loading}>
        {refunds.length === 0 ? (
          <EmptyState title="暂无退款记录" description="退款申请将显示在这里" />
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

      <Modal
        title="申请退款"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="tenantId" label="租客" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="请选择租客"
              options={tenants.map((t) => ({
                value: t.id,
                label: `${t.name} (${t.phone})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="type" label="退款类型" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'DEPOSIT', label: '退押金' },
                { value: 'PREPAID', label: '退预付款' },
                { value: 'OVERPAY', label: '退多收款' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="amount"
            label="退款金额"
            rules={[{ required: true }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              prefix="¥"
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label="退款原因"
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
