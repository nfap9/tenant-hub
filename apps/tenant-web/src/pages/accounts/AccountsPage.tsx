// PAGE-310: 资金账户页面
import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  message,
  Spin,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Row,
  Col,
  Statistic,
} from 'antd';
import { PlusOutlined, ReloadOutlined, SwapOutlined } from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { money } from '@/utils/format';
import {
  getAccounts,
  createAccount,
  getAllTransfers,
  transferBetweenAccounts,
  type Account,
  type TransferRecord,
} from '@/api/accounts';
import styles from './AccountsPage.module.scss';

const typeLabels: Record<string, string> = {
  CASH: '现金',
  BANK: '银行账户',
  WECHAT: '微信商户',
  ALIPAY: '支付宝商户',
};

const typeColors: Record<string, string> = {
  CASH: 'green',
  BANK: 'blue',
  WECHAT: 'success',
  ALIPAY: 'processing',
};

export default function AccountsPage() {
  const { currentOrgId } = useAppSession();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [transferForm] = Form.useForm();

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const [accts, tsfrs] = await Promise.all([
        getAccounts(),
        getAllTransfers(),
      ]);
      setAccounts(accts);
      setTransfers(tsfrs);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (values: {
    name: string;
    type: 'CASH' | 'BANK' | 'WECHAT' | 'ALIPAY';
    bankName?: string;
    accountNo?: string;
  }) => {
    if (!currentOrgId) return;
    try {
      await createAccount(values);
      message.success('账户已创建');
      setModalOpen(false);
      form.resetFields();
      loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建失败');
    }
  };

  const handleTransfer = async (values: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    note?: string;
  }) => {
    if (!currentOrgId) return;
    try {
      await transferBetweenAccounts(values);
      message.success('转账已完成');
      setTransferModalOpen(false);
      transferForm.resetFields();
      loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '转账失败');
    }
  };

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  const columns = [
    {
      title: '账户名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => (
        <Tag color={typeColors[v]}>{typeLabels[v] || v}</Tag>
      ),
    },
    {
      title: '余额',
      dataIndex: 'balance',
      key: 'balance',
      render: (v: number) => (
        <span className={styles.balance}>¥{money(v)}</span>
      ),
    },
    {
      title: '银行/账号',
      key: 'bank',
      render: (_: unknown, record: Account) =>
        record.bankName ? (
          <div>
            <div>{record.bankName}</div>
            <div className="text-muted">{record.accountNo}</div>
          </div>
        ) : (
          '-'
        ),
    },
  ];

  const transferColumns = [
    {
      title: '转出账户',
      dataIndex: 'fromAccountId',
      key: 'from',
      render: (v: string) => accounts.find((a) => a.id === v)?.name || v,
    },
    {
      title: '转入账户',
      dataIndex: 'toAccountId',
      key: 'to',
      render: (v: string) => accounts.find((a) => a.id === v)?.name || v,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (v: number) => <span>¥{money(v)}</span>,
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      render: (v?: string) => v || '-',
    },
  ];

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[{ label: '资金账户' }]}
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
              icon={<SwapOutlined />}
              onClick={() => {
                transferForm.resetFields();
                setTransferModalOpen(true);
              }}
            >
              转账
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                form.resetFields();
                setModalOpen(true);
              }}
            >
              新增账户
            </Button>
          </>
        }
      />

      <Row gutter={16} className="mb-16">
        <Col span={8}>
          <Card>
            <Statistic
              title="总余额"
              value={money(totalBalance)}
              prefix="¥"
              valueStyle={{ fontWeight: 700, fontSize: 28, color: '#22c55e' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="账户数量"
              value={accounts.length}
              valueStyle={{ fontWeight: 700, fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="转账记录"
              value={transfers.length}
              valueStyle={{ fontWeight: 700, fontSize: 28 }}
            />
          </Card>
        </Col>
      </Row>

      <Spin spinning={loading}>
        {accounts.length === 0 ? (
          <EmptyState title="暂无资金账户" description="点击右上角新增账户" />
        ) : (
          <>
            <Card title="账户列表" className="mb-16">
              <Table
                rowKey="id"
                dataSource={accounts}
                columns={columns}
                pagination={false}
              />
            </Card>

            <Card title="转账记录">
              <Table
                rowKey="id"
                dataSource={transfers}
                columns={transferColumns}
                pagination={{ pageSize: 10 }}
              />
            </Card>
          </>
        )}
      </Spin>

      <Modal
        title="新增账户"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="账户名称" rules={[{ required: true }]}>
            <Input placeholder="例如：公司银行账户" />
          </Form.Item>
          <Form.Item name="type" label="账户类型" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'CASH', label: '现金' },
                { value: 'BANK', label: '银行账户' },
                { value: 'WECHAT', label: '微信商户' },
                { value: 'ALIPAY', label: '支付宝商户' },
              ]}
            />
          </Form.Item>
          <Form.Item name="bankName" label="开户行">
            <Input />
          </Form.Item>
          <Form.Item name="accountNo" label="账号">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="账户间转账"
        open={transferModalOpen}
        onCancel={() => setTransferModalOpen(false)}
        onOk={() => transferForm.submit()}
      >
        <Form form={transferForm} layout="vertical" onFinish={handleTransfer}>
          <Form.Item
            name="fromAccountId"
            label="转出账户"
            rules={[{ required: true }]}
          >
            <Select
              options={accounts.map((a) => ({
                value: a.id,
                label: `${a.name} (¥${money(a.balance)})`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="toAccountId"
            label="转入账户"
            rules={[{ required: true }]}
          >
            <Select
              options={accounts.map((a) => ({
                value: a.id,
                label: a.name,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="amount"
            label="转账金额"
            rules={[{ required: true }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              prefix="¥"
            />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
