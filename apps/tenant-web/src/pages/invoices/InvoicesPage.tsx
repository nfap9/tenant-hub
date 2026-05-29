import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import {
  getInvoices,
  createInvoice,
  updateInvoiceStatus,
  type Invoice,
} from '@/api/invoices';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { money } from '@/utils/format';

const statusMap: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待开', color: 'orange' },
  ISSUED: { label: '已开', color: 'blue' },
  SENT: { label: '已寄出', color: 'purple' },
  RECEIVED: { label: '已签收', color: 'green' },
};

export default function InvoicesPage() {
  const { currentOrgId } = useAppSession();
  const canManage = useHasPermission('bill:manage');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const data = await getInvoices(currentOrgId);
      setInvoices(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!currentOrgId) return;
    try {
      await createInvoice(currentOrgId, values as Invoice);
      message.success('开票申请已提交');
      setModalOpen(false);
      form.resetFields();
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    if (!currentOrgId) return;
    try {
      await updateInvoiceStatus(currentOrgId, id, { status });
      message.success('状态已更新');
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '更新失败');
    }
  };

  const columns = [
    { title: '发票抬头', dataIndex: 'title', key: 'title' },
    { title: '税号', dataIndex: 'taxNo', key: 'taxNo' },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (v: string | number) => `¥${money(v)}`,
    },
    { title: '内容', dataIndex: 'content', key: 'content' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => (
        <Tag color={statusMap[v]?.color}>{statusMap[v]?.label}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Invoice) => (
        <Space>
          {canManage && (
            <Select
              size="small"
              value={record.status}
              style={{ width: 100 }}
              onChange={(v) => handleStatusChange(record.id, v)}
              options={Object.entries(statusMap).map(([value, { label }]) => ({
                value,
                label,
              }))}
            />
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[{ label: '发票管理' }]}
        actions={
          canManage && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                form.resetFields();
                setModalOpen(true);
              }}
            >
              申请开票
            </Button>
          )
        }
      />
      {invoices.length === 0 && !loading ? (
        <EmptyState title="暂无发票记录" description="点击右上角申请开票" />
      ) : (
        <Table
          rowKey="id"
          loading={loading}
          dataSource={invoices}
          columns={columns}
          pagination={{ pageSize: 20 }}
        />
      )}
      <Modal
        title="申请开票"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="title" label="发票抬头" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="taxNo" label="税号">
            <Input />
          </Form.Item>
          <Form.Item name="amount" label="金额" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="content" label="开票内容">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="邮寄地址">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
