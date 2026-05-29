import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Tag,
  Spin,
  message,
  Row,
  Col,
  Divider,
  Table,
  Modal,
  Input,
  Form,
  InputNumber,
} from 'antd';
import {
  EditOutlined,
  UserOutlined,
  WalletOutlined,
  FileTextOutlined,
  TransactionOutlined,
} from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import {
  getTenant,
  getTenantAccount,
  getTenantAccountTransactions,
  adjustTenantAccount,
} from '@/api/tenants';
import type { Tenant, AccountTransaction, Lease } from '@/types/domain';
import { money, day } from '@/utils/format';
import PageHeader from '@/components/ui/PageHeader';
import DetailSection from '@/components/ui/DetailSection';
import DetailItem from '@/components/ui/DetailItem';
import styles from './TenantDetailPage.module.scss';

const sourceChannelLabels: Record<string, string> = {
  PLATFORM_58: '58同城',
  DOUBAN: '豆瓣',
  BEIKE: '贝壳',
  REFERRAL: '转介绍',
  AGENT: '中介',
  WALK_IN: '上门',
  OTHER: '其他',
};

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

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageTenant = useHasPermission('lease:manage');

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [account, setAccount] = useState<{
    prepaidBalance: string | number;
    depositBalance: string | number;
    totalUnpaid: string | number;
    netBalance: string | number;
  } | null>(null);
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [transactionTotal, setTransactionTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustForm] = Form.useForm();
  const [transactionPage, setTransactionPage] = useState(1);

  const loadData = useCallback(async () => {
    if (!currentOrgId || !id) return;
    setLoading(true);
    try {
      const [t, acc, txns] = await Promise.all([
        getTenant(currentOrgId, id),
        getTenantAccount(currentOrgId, id),
        getTenantAccountTransactions(currentOrgId, id, 1, 10),
      ]);
      setTenant(t);
      setAccount(acc);
      setTransactions(txns.items);
      setTransactionTotal(txns.total);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载租客详情失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdjust = async (values: { amount: number; note?: string }) => {
    if (!currentOrgId || !id) return;
    try {
      await adjustTenantAccount(currentOrgId, id, values);
      message.success('调账成功');
      setAdjustModalOpen(false);
      adjustForm.resetFields();
      loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '调账失败');
    }
  };

  const loadTransactions = async (page: number) => {
    if (!currentOrgId || !id) return;
    try {
      const data = await getTenantAccountTransactions(
        currentOrgId,
        id,
        page,
        10
      );
      setTransactions(data.items);
      setTransactionTotal(data.total);
      setTransactionPage(page);
    } catch {
      message.error('加载交易流水失败');
    }
  };

  if (!tenant && !loading) {
    return (
      <div className="page-content">
        <PageHeader breadcrumb={[{ label: '租客管理' }, { label: '详情' }]} />
        <div>租客不存在</div>
      </div>
    );
  }

  const leaseColumns = [
    {
      title: '房间',
      key: 'room',
      render: (_: unknown, record: Lease) =>
        `${record.room?.apartment?.name} ${record.room?.roomNo}`,
    },
    {
      title: '租期',
      key: 'period',
      render: (_: unknown, record: Lease) =>
        `${day(record.startDate)} ~ ${day(record.endDate)}`,
    },
    {
      title: '月租金',
      dataIndex: 'rentAmount',
      key: 'rentAmount',
      render: (v: string | number) => money(v),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => (
        <Tag
          color={
            v === 'ACTIVE'
              ? 'success'
              : v === 'TERMINATED'
                ? 'default'
                : 'warning'
          }
        >
          {v === 'ACTIVE' ? '生效中' : v === 'TERMINATED' ? '已终止' : v}
        </Tag>
      ),
    },
  ];

  const transactionColumns = [
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
    <div className="page-content">
      <PageHeader
        breadcrumb={[
          { label: '租客管理', path: '/tenants' },
          { label: tenant?.name || '详情' },
        ]}
      />

      <Spin spinning={loading}>
        {tenant && (
          <>
            {/* 基础档案 */}
            <DetailSection
              title={
                <>
                  <UserOutlined /> 基础档案
                </>
              }
              actions={
                canManageTenant && (
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => navigate(`/tenants/${tenant.id}/edit`)}
                  >
                    编辑
                  </Button>
                )
              }
            >
              <Row gutter={[24, 0]}>
                <Col span={8}>
                  <DetailItem label="姓名">{tenant.name}</DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="手机号">{tenant.phone}</DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="身份证号">
                    {tenant.idCard || '-'}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="紧急联系人">
                    {tenant.emergencyContact || '-'}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="紧急联系电话">
                    {tenant.emergencyPhone || '-'}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="工作单位">
                    {tenant.workUnit || '-'}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="职位">{tenant.jobTitle || '-'}</DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="来源渠道">
                    {tenant.sourceChannel ? (
                      <Tag>
                        {sourceChannelLabels[tenant.sourceChannel] ||
                          tenant.sourceChannel}
                      </Tag>
                    ) : (
                      '-'
                    )}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="信用分">
                    {tenant.creditScore !== undefined ? (
                      <Tag
                        color={
                          tenant.creditScore >= 80
                            ? 'success'
                            : tenant.creditScore >= 60
                              ? 'warning'
                              : 'error'
                        }
                      >
                        {tenant.creditScore}
                      </Tag>
                    ) : (
                      '-'
                    )}
                  </DetailItem>
                </Col>
                <Col span={24}>
                  <DetailItem label="备注">{tenant.remark || '-'}</DetailItem>
                </Col>
              </Row>
            </DetailSection>

            <Divider />

            {/* 账户余额 */}
            <DetailSection
              title={
                <>
                  <WalletOutlined /> 账户余额
                </>
              }
              actions={
                canManageTenant && (
                  <Button onClick={() => setAdjustModalOpen(true)}>调账</Button>
                )
              }
            >
              <Row gutter={[24, 0]}>
                <Col span={6}>
                  <DetailItem label="预付余额">
                    {account ? money(account.prepaidBalance) : '-'}
                  </DetailItem>
                </Col>
                <Col span={6}>
                  <DetailItem label="押金余额">
                    {account ? money(account.depositBalance) : '-'}
                  </DetailItem>
                </Col>
                <Col span={6}>
                  <DetailItem label="待付总额">
                    {account ? money(account.totalUnpaid) : '-'}
                  </DetailItem>
                </Col>
                <Col span={6}>
                  <DetailItem label="净余额">
                    {account ? (
                      <span
                        className={
                          Number(account.netBalance) < 0
                            ? styles.negative
                            : styles.positive
                        }
                      >
                        {money(account.netBalance)}
                      </span>
                    ) : (
                      '-'
                    )}
                  </DetailItem>
                </Col>
              </Row>
            </DetailSection>

            <Divider />

            {/* 交易流水 */}
            <DetailSection
              title={
                <>
                  <TransactionOutlined /> 交易流水
                </>
              }
            >
              <Table
                dataSource={transactions}
                columns={transactionColumns}
                rowKey="id"
                pagination={{
                  current: transactionPage,
                  pageSize: 10,
                  total: transactionTotal,
                  onChange: loadTransactions,
                }}
              />
            </DetailSection>

            <Divider />

            {/* 租约历史 */}
            <DetailSection
              title={
                <>
                  <FileTextOutlined /> 租约历史
                </>
              }
            >
              <Table
                dataSource={tenant.leases || []}
                columns={leaseColumns}
                rowKey="id"
                pagination={false}
              />
            </DetailSection>
          </>
        )}
      </Spin>

      <Modal
        title="账户调账"
        open={adjustModalOpen}
        onCancel={() => {
          setAdjustModalOpen(false);
          adjustForm.resetFields();
        }}
        onOk={() => adjustForm.submit()}
      >
        <Form form={adjustForm} layout="vertical" onFinish={handleAdjust}>
          <Form.Item
            label="调账金额"
            name="amount"
            rules={[{ required: true, message: '请输入调账金额' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="正数表示增加余额，负数表示扣减"
            />
          </Form.Item>
          <Form.Item label="备注" name="note">
            <Input.TextArea rows={3} placeholder="请输入调账原因" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
