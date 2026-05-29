import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Tag,
  Spin,
  message,
  Timeline,
  Divider,
  Row,
  Col,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
} from 'antd';
import {
  ReloadOutlined,
  WalletOutlined,
  MinusOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { getDepositDetail, recordDepositPayment } from '@/api/deposits';
import { money } from '@/utils/format';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import DetailSection from '@/components/ui/DetailSection';
import DetailItem from '@/components/ui/DetailItem';
import type { Deposit, DepositStatus, Payment } from '@/types/domain';
import styles from './DepositDetailPage.module.scss';

const statusLabels: Record<DepositStatus, string> = {
  UNPAID: '未收取',
  PAID: '已收取',
  PARTIAL_REFUNDED: '部分退还',
  FULLY_REFUNDED: '已全额退还',
  DEDUCTED: '已扣款',
};

const statusColors: Record<DepositStatus, string> = {
  UNPAID: 'warning',
  PAID: 'success',
  PARTIAL_REFUNDED: 'processing',
  FULLY_REFUNDED: 'default',
  DEDUCTED: 'error',
};

const paymentTypeLabels: Record<string, string> = {
  RECEIVE: '收取',
  REFUND: '退还',
  DEDUCT: '扣款',
};

export default function DepositDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();

  const [deposit, setDeposit] = useState<Deposit | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<
    'COLLECT' | 'REFUND' | 'DEDUCT'
  >('COLLECT');
  const [paymentForm] = Form.useForm();
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOrgId || !id) return;
    setLoading(true);
    try {
      const data = await getDepositDetail(currentOrgId, id);
      setDeposit(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载押金详情失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!deposit && !loading) {
    return (
      <div className="page-content">
        <EmptyState
          title="押金记录不存在"
          action={{
            label: '返回押金列表',
            onClick: () => navigate('/deposits'),
          }}
        />
      </div>
    );
  }

  const paymentMap = new Map<string, Payment>();
  for (const bill of deposit?.lease?.bills ?? []) {
    for (const payment of bill.payments ?? []) {
      paymentMap.set(payment.id, payment);
    }
  }
  for (const payment of deposit?.bill?.payments ?? []) {
    paymentMap.set(payment.id, payment);
  }
  const allPayments = Array.from(paymentMap.values()).sort(
    (a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime()
  );

  return (
    <div className="page-content">
      <PageHeader
        back="/deposits"
        breadcrumb={[
          { label: '押金管理', path: '/deposits' },
          { label: '押金详情' },
        ]}
      />

      <Spin spinning={loading}>
        {deposit && (
          <>
            <DetailSection
              title="押金信息"
              actions={
                <>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={loadData}
                    loading={loading}
                  >
                    刷新
                  </Button>
                  {deposit?.leaseId && (
                    <Button
                      type="primary"
                      icon={<WalletOutlined />}
                      onClick={() => {
                        setPaymentType('COLLECT');
                        setPaymentOpen(true);
                      }}
                    >
                      登记收款
                    </Button>
                  )}
                  {deposit?.leaseId && (
                    <Button
                      icon={<MinusOutlined />}
                      onClick={() => {
                        setPaymentType('REFUND');
                        setPaymentOpen(true);
                      }}
                    >
                      退款
                    </Button>
                  )}
                  {deposit?.leaseId && (
                    <Button
                      danger
                      icon={<DollarOutlined />}
                      onClick={() => {
                        setPaymentType('DEDUCT');
                        setPaymentOpen(true);
                      }}
                    >
                      抵扣
                    </Button>
                  )}
                </>
              }
            >
              <Row gutter={[24, 0]}>
                <Col span={8}>
                  <DetailItem label="租客">
                    {deposit.lease?.tenantName}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="房间">
                    {deposit.lease?.room?.roomNo}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="约定押金">
                    ¥{money(deposit.amount)}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="状态">
                    <Tag color={statusColors[deposit.status]}>
                      {statusLabels[deposit.status]}
                    </Tag>
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="已收">
                    ¥{money(deposit.paidAmount)}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="已退">
                    ¥{money(deposit.refundedAmount)}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="已扣">
                    ¥{money(deposit.deductedAmount)}
                  </DetailItem>
                </Col>
                <Col span={8}>
                  <DetailItem label="可退余额">
                    ¥
                    {money(
                      Number(deposit.paidAmount) -
                        Number(deposit.refundedAmount) -
                        Number(deposit.deductedAmount)
                    )}
                  </DetailItem>
                </Col>
              </Row>
            </DetailSection>

            <Divider />

            <DetailSection title="收退流水">
              {allPayments.length > 0 ? (
                <Timeline
                  items={allPayments.map((p: Payment) => ({
                    children: (
                      <div>
                        <div className={styles.paymentHeader}>
                          <Tag
                            color={
                              p.type === 'RECEIVE'
                                ? 'success'
                                : p.type === 'REFUND'
                                  ? 'processing'
                                  : 'error'
                            }
                          >
                            {paymentTypeLabels[p.type]}
                          </Tag>
                          <span className={styles.paymentAmount}>
                            ¥{money(p.amount)}
                          </span>
                          <span className="text-muted">{p.method}</span>
                        </div>
                        <div className={styles.paymentMeta}>
                          <span className="text-muted">
                            {new Date(p.paidAt).toLocaleString()}
                          </span>
                          {p.user && (
                            <span className="text-muted">
                              操作人：{p.user.username}
                            </span>
                          )}
                        </div>
                        {p.note && <div className="text-muted">{p.note}</div>}
                      </div>
                    ),
                  }))}
                />
              ) : (
                <EmptyState title="暂无流水" />
              )}
            </DetailSection>
          </>
        )}
      </Spin>

      <Modal
        open={paymentOpen}
        title={
          paymentType === 'COLLECT'
            ? '登记押金收款'
            : paymentType === 'REFUND'
              ? '登记押金退款'
              : '登记押金抵扣'
        }
        onCancel={() => {
          setPaymentOpen(false);
          paymentForm.resetFields();
        }}
        onOk={async () => {
          const values = await paymentForm.validateFields();
          if (!currentOrgId || !deposit) return;
          setPaymentSubmitting(true);
          try {
            await recordDepositPayment(currentOrgId, deposit.id, {
              type: paymentType,
              amount: Number(values.amount),
              method: values.method,
              note: values.note,
            });
            message.success(
              paymentType === 'COLLECT'
                ? '收款登记成功'
                : paymentType === 'REFUND'
                  ? '退款登记成功'
                  : '抵扣登记成功'
            );
            setPaymentOpen(false);
            paymentForm.resetFields();
            loadData();
          } catch (e) {
            message.error(e instanceof Error ? e.message : '操作失败');
          } finally {
            setPaymentSubmitting(false);
          }
        }}
        confirmLoading={paymentSubmitting}
      >
        <Form form={paymentForm} layout="vertical">
          <Form.Item
            label="金额"
            name="amount"
            rules={[{ required: true, message: '请输入金额' }]}
          >
            <InputNumber
              min={0}
              className="w-full"
              prefix="¥"
              placeholder="请输入金额"
            />
          </Form.Item>
          <Form.Item
            label="支付方式"
            name="method"
            rules={[{ required: true, message: '请选择支付方式' }]}
          >
            <Select
              placeholder="请选择支付方式"
              options={[
                { label: '现金', value: 'CASH' },
                { label: '银行转账', value: 'BANK_TRANSFER' },
                { label: '微信支付', value: 'WECHAT' },
                { label: '支付宝', value: 'ALIPAY' },
                { label: 'POS机', value: 'POS' },
              ]}
            />
          </Form.Item>
          <Form.Item label="备注" name="note">
            <Input.TextArea placeholder="可选：填写备注信息" rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
