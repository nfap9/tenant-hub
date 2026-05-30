// PAGE-118: 房东付款计划页面
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Button,
  Table,
  Tag,
  Spin,
  message,
  Popconfirm,
  Modal,
  Form,
  InputNumber,
  DatePicker,
  Input,
  Select,
  Space,
  Alert,
  Checkbox,
} from 'antd';
import { DeleteOutlined, DollarOutlined } from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import {
  getLandlordPayments,
  recordLandlordPayment,
  deleteLandlordPayment,
  type LandlordPayment,
} from '@/api/landlordPayments';
import { getLandlordContracts } from '@/api/landlordContracts';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { money } from '@/utils/format';
import dayjs from 'dayjs';

const statusMap: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待付款', color: 'orange' },
  PAID: { label: '已付款', color: 'green' },
  OVERDUE: { label: '已逾期', color: 'red' },
};

export default function LandlordPaymentListPage() {
  const { currentOrgId } = useAppSession();
  const canManage = useHasPermission('apartment:manage');
  const [searchParams] = useSearchParams();
  const initialContractId = searchParams.get('contractId') || undefined;

  const [payments, setPayments] = useState<LandlordPayment[]>([]);
  const [contracts, setContracts] = useState<
    { id: string; contractNo?: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [contractFilter, setContractFilter] = useState<string | undefined>(
    initialContractId
  );
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payForm] = Form.useForm();

  const load = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const [data, contractList] = await Promise.all([
        getLandlordPayments(currentOrgId, {
          contractId: contractFilter,
          status: statusFilter,
        }),
        getLandlordContracts(currentOrgId),
      ]);
      setPayments(data);
      setContracts(contractList);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, contractFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePay = async (values: Record<string, unknown>) => {
    if (!currentOrgId || !payingId) return;
    try {
      await recordLandlordPayment(currentOrgId, payingId, {
        paidAmount: Number(values.paidAmount),
        paidAt: dayjs(values.paidAt as string).format('YYYY-MM-DD'),
        voucherNo: values.voucherNo ? String(values.voucherNo) : undefined,
        paymentMethod: values.paymentMethod
          ? String(values.paymentMethod)
          : undefined,
        note: values.note ? String(values.note) : undefined,
        createExpense: Boolean(values.createExpense),
      });
      message.success('付款记录已保存');
      setPayModalOpen(false);
      setPayingId(null);
      payForm.resetFields();
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentOrgId) return;
    try {
      await deleteLandlordPayment(currentOrgId, id);
      message.success('已删除');
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  const overdueCount = payments.filter(
    (p) => p.status === 'PENDING' && new Date(p.dueDate) < new Date()
  ).length;

  const columns = [
    {
      title: '合同编号',
      render: (_: unknown, r: LandlordPayment) =>
        r.landlordContract?.contractNo || '-',
    },
    {
      title: '公寓',
      render: (_: unknown, r: LandlordPayment) => r.apartment?.name || '-',
    },
    {
      title: '付款周期',
      render: (_: unknown, r: LandlordPayment) =>
        `${r.periodStart} ~ ${r.periodEnd}`,
    },
    {
      title: '应付日期',
      dataIndex: 'dueDate',
    },
    {
      title: '应付金额',
      render: (_: unknown, r: LandlordPayment) => (
        <span style={{ fontWeight: 500 }}>¥{money(r.plannedAmount)}</span>
      ),
    },
    {
      title: '实付金额',
      render: (_: unknown, r: LandlordPayment) =>
        r.paidAmount ? `¥${money(r.paidAmount)}` : '-',
    },
    {
      title: '实付日期',
      render: (_: unknown, r: LandlordPayment) => r.paidAt || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: string, r: LandlordPayment) => {
        const isOverdue = v === 'PENDING' && new Date(r.dueDate) < new Date();
        return (
          <Tag color={isOverdue ? 'red' : statusMap[v]?.color}>
            {isOverdue ? '已逾期' : statusMap[v]?.label}
          </Tag>
        );
      },
    },
    {
      title: '凭证号',
      render: (_: unknown, r: LandlordPayment) => r.voucherNo || '-',
    },
    {
      title: '操作',
      render: (_: unknown, r: LandlordPayment) => (
        <Space>
          {r.status !== 'PAID' && canManage && (
            <Button
              size="small"
              type="primary"
              icon={<DollarOutlined />}
              onClick={() => {
                setPayingId(r.id);
                payForm.setFieldsValue({
                  paidAmount: Number(r.plannedAmount),
                  paidAt: dayjs(),
                });
                setPayModalOpen(true);
              }}
            >
              付款
            </Button>
          )}
          {r.status !== 'PAID' && canManage && (
            <Popconfirm
              title="删除付款计划"
              onConfirm={() => handleDelete(r.id)}
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="page-content">
      <PageHeader breadcrumb={[{ label: '房东付款计划' }]} />

      {overdueCount > 0 && (
        <Alert
          message={`有 ${overdueCount} 笔付款计划已逾期，请及时处理`}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Space style={{ marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="按合同筛选"
          style={{ width: 200 }}
          value={contractFilter}
          onChange={setContractFilter}
          options={contracts.map((c) => ({
            value: c.id,
            label: c.contractNo || c.id.slice(0, 8),
          }))}
        />
        <Select
          allowClear
          placeholder="按状态筛选"
          style={{ width: 140 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={Object.entries(statusMap).map(([value, { label }]) => ({
            value,
            label,
          }))}
        />
      </Space>

      <Spin spinning={loading}>
        {payments.length === 0 && !loading ? (
          <EmptyState
            title="暂无付款计划"
            description="请在房东合同详情页生成付款计划"
          />
        ) : (
          <Table
            rowKey="id"
            dataSource={payments}
            columns={columns}
            pagination={{ pageSize: 20 }}
          />
        )}
      </Spin>

      <Modal
        title="记录付款"
        open={payModalOpen}
        onCancel={() => {
          setPayModalOpen(false);
          setPayingId(null);
          payForm.resetFields();
        }}
        onOk={() => payForm.submit()}
      >
        <Form form={payForm} layout="vertical" onFinish={handlePay}>
          <Form.Item
            name="paidAmount"
            label="实付金额"
            rules={[{ required: true }]}
          >
            <InputNumber prefix="¥" min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="paidAt"
            label="付款日期"
            rules={[{ required: true }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="paymentMethod" label="付款方式">
            <Select
              allowClear
              placeholder="请选择"
              options={[
                { value: 'CASH', label: '现金' },
                { value: 'BANK_TRANSFER', label: '银行转账' },
                { value: 'WECHAT', label: '微信' },
                { value: 'ALIPAY', label: '支付宝' },
              ]}
            />
          </Form.Item>
          <Form.Item name="voucherNo" label="凭证号">
            <Input placeholder="请输入付款凭证号" />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            name="createExpense"
            valuePropName="checked"
            initialValue={true}
          >
            <Checkbox>同步生成公寓运营支出记录</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
