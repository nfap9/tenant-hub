import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Table,
  Tag,
  Space,
  DatePicker,
  Select,
  Input,
  Statistic,
  Row,
  Col,
  message,
  Modal,
  Form,
  Radio,
  InputNumber,
  Drawer,
  Descriptions,
  Spin,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  DeleteOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAppSession } from '@/context/AppSessionContext';
import {
  getTransactions,
  getTransactionSummary,
  getTransactionCategories,
  createTransaction,
  deleteTransaction,
} from '@/api/transactions';
import { money } from '@/utils/format';
import PageHeader from '@/components/ui/PageHeader';
import type { Transaction, TransactionCategory } from '@/types/domain';
import type { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

const typeColors = {
  INCOME: 'success',
  EXPENSE: 'error',
} as const;

const typeLabels = {
  INCOME: '收入',
  EXPENSE: '支出',
} as const;

export default function TransactionsPage() {
  const { currentOrgId } = useAppSession();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{
    totalIncome: string | number;
    totalExpense: string | number;
    netAmount: string | number;
  } | null>(null);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 筛选状态
  const [type, setType] = useState<string | undefined>();
  const [category, setCategory] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<
    [Dayjs | null, Dayjs | null] | null
  >(null);
  const [keyword, setKeyword] = useState('');

  // 弹窗状态
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [form] = Form.useForm();

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const [data, sum, cats] = await Promise.all([
        getTransactions({
          type: type as any,
          category,
          startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
          endDate: dateRange?.[1]?.format('YYYY-MM-DD'),
          keyword: keyword || undefined,
          page,
          pageSize,
        }),
        getTransactionSummary({
          startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
          endDate: dateRange?.[1]?.format('YYYY-MM-DD'),
        }),
        getTransactionCategories(),
      ]);
      setTransactions(data.items);
      setTotal(data.total);
      setSummary(sum);
      setCategories(cats);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载收支记录失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, type, category, dateRange, keyword, page, pageSize]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (values: any) => {
    try {
      await createTransaction({
        ...values,
        amount: Number(values.amount),
        occurredAt: values.occurredAt?.format(),
      });
      message.success('创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建失败');
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条收支记录吗？',
      onOk: async () => {
        try {
          await deleteTransaction(id);
          message.success('删除成功');
          loadData();
        } catch (e) {
          message.error(e instanceof Error ? e.message : '删除失败');
        }
      },
    });
  };

  const filteredCategories = categories.filter((c) => !type || c.type === type);

  const columns = [
    {
      title: '发生时间',
      dataIndex: 'occurredAt',
      width: 170,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 80,
      render: (v: string) => (
        <Tag color={typeColors[v as keyof typeof typeColors]}>
          {typeLabels[v as keyof typeof typeLabels]}
        </Tag>
      ),
    },
    {
      title: '科目',
      dataIndex: 'category',
      width: 120,
      render: (v: string) => {
        const cat = categories.find((c) => c.key === v);
        return cat?.label || v;
      },
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 120,
      align: 'right' as const,
      render: (v: string | number, record: Transaction) => (
        <span
          style={{
            color: record.type === 'INCOME' ? '#22C55E' : '#DC2626',
            fontWeight: 600,
          }}
        >
          {record.type === 'INCOME' ? '+' : '-'} {money(v)}
        </span>
      ),
    },
    {
      title: '关联对象',
      dataIndex: 'description',
      ellipsis: true,
      render: (_v: string, record: Transaction) =>
        record.lease
          ? `${record.lease.room?.apartment?.name} - ${record.lease.room?.roomNo} (${record.lease.tenantName})`
          : record.apartment?.name || record.description || '-',
    },
    {
      title: '支付方式',
      dataIndex: 'method',
      width: 100,
    },
    {
      title: '操作人',
      dataIndex: ['operator', 'username'],
      width: 100,
      render: (v: string) => v || '-',
    },
    {
      title: '操作',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: Transaction) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedTransaction(record);
              setDetailDrawerOpen(true);
            }}
          />
          {record.sourceType === 'MANUAL' && (
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id)}
            />
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader>
        <h1>收支记录</h1>
      </PageHeader>

      {/* 统计卡片 */}
      {summary && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Card>
              <Statistic
                title="总收入"
                value={money(summary.totalIncome)}
                valueStyle={{ color: '#22C55E' }}
                prefix={<ArrowUpOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="总支出"
                value={money(summary.totalExpense)}
                valueStyle={{ color: '#DC2626' }}
                prefix={<ArrowDownOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="净额"
                value={money(summary.netAmount)}
                valueStyle={{
                  color: Number(summary.netAmount) >= 0 ? '#22C55E' : '#DC2626',
                }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 筛选栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="收支类型"
            allowClear
            style={{ width: 120 }}
            value={type}
            onChange={setType}
            options={[
              { label: '收入', value: 'INCOME' },
              { label: '支出', value: 'EXPENSE' },
            ]}
          />
          <Select
            placeholder="科目"
            allowClear
            style={{ width: 150 }}
            value={category}
            onChange={setCategory}
            options={filteredCategories.map((c) => ({
              label: c.label,
              value: c.key,
            }))}
          />
          <RangePicker
            placeholder={['开始日期', '结束日期']}
            value={dateRange}
            onChange={setDateRange}
          />
          <Input
            placeholder="搜索描述或备注"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 200 }}
            prefix={<SearchOutlined />}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            手动录入
          </Button>
        </Space>
      </Card>

      {/* 表格 */}
      <Card>
        <Table
          columns={columns}
          dataSource={transactions}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* 创建弹窗 */}
      <Modal
        title="手动录入收支"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="type"
            label="收支类型"
            rules={[{ required: true, message: '请选择收支类型' }]}
          >
            <Radio.Group
              options={[
                { label: '收入', value: 'INCOME' },
                { label: '支出', value: 'EXPENSE' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="category"
            label="科目"
            rules={[{ required: true, message: '请选择科目' }]}
          >
            <Select
              options={categories.map((c) => ({
                label: c.label,
                value: c.key,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="amount"
            label="金额"
            rules={[{ required: true, message: '请输入金额' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              prefix="¥"
              min={0.01}
              step={0.01}
              precision={2}
            />
          </Form.Item>
          <Form.Item
            name="method"
            label="支付方式"
            rules={[{ required: true, message: '请输入支付方式' }]}
            initialValue="现金"
          >
            <Input placeholder="如：现金、微信、支付宝" />
          </Form.Item>
          <Form.Item name="occurredAt" label="发生时间">
            <DatePicker
              showTime
              style={{ width: '100%' }}
              placeholder="默认为当前时间"
            />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情抽屉 */}
      <Drawer
        title="收支详情"
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        width={480}
      >
        {selectedTransaction ? (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="类型">
              <Tag color={typeColors[selectedTransaction.type]}>
                {typeLabels[selectedTransaction.type]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="科目">
              {categories.find((c) => c.key === selectedTransaction.category)
                ?.label || selectedTransaction.category}
            </Descriptions.Item>
            <Descriptions.Item label="金额">
              <span
                style={{
                  color:
                    selectedTransaction.type === 'INCOME'
                      ? '#22C55E'
                      : '#DC2626',
                  fontWeight: 600,
                  fontSize: 16,
                }}
              >
                {selectedTransaction.type === 'INCOME' ? '+' : '-'}{' '}
                {money(selectedTransaction.amount)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="支付方式">
              {selectedTransaction.method}
            </Descriptions.Item>
            <Descriptions.Item label="发生时间">
              {dayjs(selectedTransaction.occurredAt).format(
                'YYYY-MM-DD HH:mm:ss'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="来源">
              {selectedTransaction.sourceType === 'MANUAL'
                ? '手动录入'
                : selectedTransaction.sourceType}
            </Descriptions.Item>
            {selectedTransaction.lease && (
              <>
                <Descriptions.Item label="租约">
                  {selectedTransaction.lease.tenantName}
                </Descriptions.Item>
                <Descriptions.Item label="房间">
                  {selectedTransaction.lease.room?.apartment?.name} -{' '}
                  {selectedTransaction.lease.room?.roomNo}
                </Descriptions.Item>
              </>
            )}
            {selectedTransaction.apartment && (
              <Descriptions.Item label="公寓">
                {selectedTransaction.apartment.name}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="描述">
              {selectedTransaction.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="备注">
              {selectedTransaction.note || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="操作人">
              {selectedTransaction.operator?.username || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(selectedTransaction.createdAt).format(
                'YYYY-MM-DD HH:mm:ss'
              )}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Spin />
        )}
      </Drawer>
    </div>
  );
}
