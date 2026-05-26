import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Tag,
  Spin,
  message,
  Modal,
  Form,
  Input,
  InputNumber,
  Radio,
  Descriptions,
  Timeline,
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { getDepositDetail, recordDepositPayment } from '@/api/deposits';
import { money } from '@/utils/format';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
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
  const canManageDeposit = useHasPermission('deposit:manage');

  const [deposit, setDeposit] = useState<Deposit | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

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

  const handlePayment = async (values: Record<string, unknown>) => {
    if (!currentOrgId || !id) return;
    try {
      await recordDepositPayment(currentOrgId, id, {
        type: String(values.type) as 'COLLECT' | 'REFUND' | 'DEDUCT',
        amount: Number(values.amount),
        method: String(values.method),
        note: values.note ? String(values.note) : undefined,
      });
      message.success('操作成功');
      setModalOpen(false);
      form.resetFields();
      loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  const availableTypes = () => {
    if (!deposit) return ['COLLECT'];
    const paid = Number(deposit.paidAmount);
    const refunded = Number(deposit.refundedAmount);
    const deducted = Number(deposit.deductedAmount);
    const types: ('COLLECT' | 'REFUND' | 'DEDUCT')[] = [];
    if (paid < Number(deposit.amount)) types.push('COLLECT');
    if (paid - refunded - deducted > 0) {
      types.push('REFUND');
      types.push('DEDUCT');
    }
    return types;
  };

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

  const payments = deposit?.bill?.payments ?? [];

  return (
    <div className="page-content">
      <PageHeader
        back="/deposits"
        breadcrumb={[
          { label: '押金管理', path: '/deposits' },
          { label: '押金详情' },
        ]}
        actions={
          <>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadData}
              loading={loading}
            >
              刷新
            </Button>
            {canManageDeposit && availableTypes().length > 0 && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setModalOpen(true)}
              >
                登记收退
              </Button>
            )}
          </>
        }
      />

      <Spin spinning={loading}>
        {deposit && (
          <>
            <Card className="mb-16">
              <Descriptions title="押金信息" column={2}>
                <Descriptions.Item label="租客">
                  {deposit.lease?.tenantName}
                </Descriptions.Item>
                <Descriptions.Item label="房间">
                  {deposit.lease?.room?.roomNo}
                </Descriptions.Item>
                <Descriptions.Item label="约定押金">
                  ¥{money(deposit.amount)}
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={statusColors[deposit.status]}>
                    {statusLabels[deposit.status]}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="已收">
                  ¥{money(deposit.paidAmount)}
                </Descriptions.Item>
                <Descriptions.Item label="已退">
                  ¥{money(deposit.refundedAmount)}
                </Descriptions.Item>
                <Descriptions.Item label="已扣">
                  ¥{money(deposit.deductedAmount)}
                </Descriptions.Item>
                <Descriptions.Item label="可退余额">
                  ¥
                  {money(
                    Number(deposit.paidAmount) -
                      Number(deposit.refundedAmount) -
                      Number(deposit.deductedAmount)
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="收退流水">
              {payments.length > 0 ? (
                <Timeline
                  items={payments.map((p: Payment) => ({
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
            </Card>
          </>
        )}
      </Spin>

      <Modal
        title="登记收退"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handlePayment}
          initialValues={{ type: availableTypes()[0] || 'COLLECT' }}
        >
          <Form.Item label="类型" name="type" rules={[{ required: true }]}>
            <Radio.Group
              options={availableTypes().map((t) => ({
                label: paymentTypeLabels[t],
                value: t,
              }))}
            />
          </Form.Item>
          <Form.Item
            label="金额"
            name="amount"
            rules={[{ required: true, message: '请输入金额' }]}
          >
            <InputNumber min={0.01} className="w-full" prefix="¥" />
          </Form.Item>
          <Form.Item
            label="方式"
            name="method"
            rules={[{ required: true, message: '请输入收款/退款方式' }]}
          >
            <Input placeholder="如：微信、支付宝、现金、银行转账" />
          </Form.Item>
          <Form.Item label="备注" name="note">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
