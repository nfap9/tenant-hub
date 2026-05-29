import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Tag,
  Card,
  Row,
  Col,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import {
  getCashierJournals,
  createCashierJournal,
  type CashierJournal,
} from '@/api/cashierJournals';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { money } from '@/utils/format';
import dayjs from 'dayjs';

export default function CashierJournalsPage() {
  const { currentOrgId } = useAppSession();
  const canManage = useHasPermission('bill:manage');
  const [journals, setJournals] = useState<CashierJournal[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [summary, setSummary] = useState({
    total: 0,
    incomeTotal: 0,
    expenseTotal: 0,
  });

  const load = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const data = await getCashierJournals(currentOrgId);
      setJournals(data.items);
      setSummary({
        total: data.total,
        incomeTotal: Number(data.incomeTotal),
        expenseTotal: Number(data.expenseTotal),
      });
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
      await createCashierJournal(currentOrgId, {
        ...values,
        date: (values.date as dayjs.Dayjs).toISOString(),
      } as CashierJournal);
      message.success('流水已记录');
      setModalOpen(false);
      form.resetFields();
      load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  const columns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      render: (v: string) => v.slice(0, 10),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) =>
        v === 'INCOME' ? (
          <Tag color="green">收入</Tag>
        ) : (
          <Tag color="red">支出</Tag>
        ),
    },
    {
      title: '科目',
      dataIndex: 'summary',
      key: 'summary',
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (v: string | number, r: CashierJournal) => (
        <span style={{ color: r.type === 'INCOME' ? '#22C55E' : '#DC2626' }}>
          {r.type === 'INCOME' ? '+' : '-'}¥{money(v)}
        </span>
      ),
    },
    { title: '支付方式', dataIndex: 'paymentMethod', key: 'paymentMethod' },
    { title: '对方', dataIndex: 'counterparty', key: 'counterparty' },
    { title: '操作人', dataIndex: ['operator', 'username'], key: 'operator' },
  ];

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[{ label: '出纳日记账' }]}
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
              记一笔
            </Button>
          )
        }
      />
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#22C55E' }}>
              ¥{money(summary.incomeTotal)}
            </div>
            <div style={{ color: '#6B7280' }}>总收入</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#DC2626' }}>
              ¥{money(summary.expenseTotal)}
            </div>
            <div style={{ color: '#6B7280' }}>总支出</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <div
              style={{
                fontSize: 24,
                fontWeight: 600,
                color:
                  summary.incomeTotal - summary.expenseTotal >= 0
                    ? '#22C55E'
                    : '#DC2626',
              }}
            >
              ¥{money(summary.incomeTotal - summary.expenseTotal)}
            </div>
            <div style={{ color: '#6B7280' }}>净收支</div>
          </Card>
        </Col>
      </Row>
      {journals.length === 0 && !loading ? (
        <EmptyState title="暂无流水记录" description="点击右上角记一笔" />
      ) : (
        <Table
          rowKey="id"
          loading={loading}
          dataSource={journals}
          columns={columns}
          pagination={{ pageSize: 20 }}
        />
      )}
      <Modal
        title="记一笔"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="date" label="日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="type" label="收支类型" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'INCOME', label: '收入' },
                { value: 'EXPENSE', label: '支出' },
              ]}
            />
          </Form.Item>
          <Form.Item name="summary" label="摘要" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="amount" label="金额" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="paymentMethod" label="支付方式">
            <Input placeholder="现金/银行转账/微信/支付宝" />
          </Form.Item>
          <Form.Item name="counterparty" label="对方">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
