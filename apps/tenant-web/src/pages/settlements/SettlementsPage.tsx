import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Table,
  Tabs,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Radio,
  message,
  Spin,
  Row,
  Col,
} from 'antd';
import {
  EyeOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { getSettlements, recordSettlementPayment } from '@/api/leases';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import DetailSection from '@/components/ui/DetailSection';
import DetailItem from '@/components/ui/DetailItem';
import type { LeaseSettlement, SettlementStatus } from '@/types/domain';
import { money, day } from '@/utils/format';
import { terminationLabels } from '@/pages/rooms/constants';
import styles from './SettlementsPage.module.scss';

const statusLabels: Record<SettlementStatus, string> = {
  PENDING: '待结算',
  SETTLED: '已结清',
};

const statusColors: Record<SettlementStatus, string> = {
  PENDING: 'warning',
  SETTLED: 'success',
};

type SettlementFilter = 'ALL' | SettlementStatus;

const filters: SettlementFilter[] = ['ALL', 'PENDING', 'SETTLED'];

export default function SettlementsPage() {
  const { currentOrgId } = useAppSession();
  const canManageLease = useHasPermission('lease:manage');
  const [settlements, setSettlements] = useState<LeaseSettlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<SettlementFilter>('ALL');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<LeaseSettlement | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const data = await getSettlements(currentOrgId);
      setSettlements(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载结算列表失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredSettlements = useMemo(() => {
    if (filter === 'ALL') return settlements;
    return settlements.filter((s) => s.status === filter);
  }, [settlements, filter]);

  const filterCounts = useMemo(() => {
    return {
      ALL: settlements.length,
      PENDING: settlements.filter((s) => s.status === 'PENDING').length,
      SETTLED: settlements.filter((s) => s.status === 'SETTLED').length,
    };
  }, [settlements]);

  const handlePayment = async (values: Record<string, unknown>) => {
    if (!currentOrgId || !selected) return;
    setSubmitting(true);
    try {
      await recordSettlementPayment(currentOrgId, selected.id, {
        direction: String(values.direction) as 'RECEIVE' | 'REFUND',
        amount: Number(values.amount),
        method: String(values.method),
        note: values.note ? String(values.note) : undefined,
      });
      message.success('登记成功');
      setPaymentOpen(false);
      paymentForm.resetFields();
      loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '登记失败');
    } finally {
      setSubmitting(false);
    }
  };

  const openPayment = (settlement: LeaseSettlement) => {
    const net = Number(settlement.netAmount);
    if (net === 0) {
      message.warning('该结算单已结清');
      return;
    }
    setSelected(settlement);
    paymentForm.setFieldsValue({
      direction: net > 0 ? 'RECEIVE' : 'REFUND',
      amount: Math.abs(net),
      method: '',
      note: '',
    });
    setPaymentOpen(true);
  };

  const openDetail = (settlement: LeaseSettlement) => {
    setSelected(settlement);
    setDetailOpen(true);
  };

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[{ label: '退租结算' }]}
        actions={
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={loadData}
          >
            刷新
          </Button>
        }
      />

      <Tabs
        activeKey={filter}
        onChange={(key) => setFilter(key as SettlementFilter)}
        items={filters.map((f) => ({
          key: f,
          label: `${statusLabels[f as SettlementStatus] ?? '全部'} (${filterCounts[f]})`,
        }))}
        className={styles.settlementTabs}
      />

      <Spin spinning={loading}>
        {filteredSettlements.length === 0 ? (
          <EmptyState title="暂无退租结算" description="当前没有退租结算记录" />
        ) : (
          <Table
            rowKey="id"
            dataSource={filteredSettlements}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 'max-content' }}
            columns={[
              {
                title: '房间',
                render: (_: unknown, row: LeaseSettlement) => (
                  <div>
                    <div>{row.room?.roomNo ?? '-'}</div>
                    <div className="text-muted">
                      {row.lease?.room?.apartment?.name ?? '-'}
                    </div>
                  </div>
                ),
              },
              {
                title: '租客',
                render: (_: unknown, row: LeaseSettlement) => (
                  <div>
                    <div>{row.lease?.tenantName ?? '-'}</div>
                    <div className="text-muted">
                      {row.lease?.tenantPhone ?? '-'}
                    </div>
                  </div>
                ),
              },
              {
                title: '退租类型',
                render: (_: unknown, row: LeaseSettlement) => (
                  <span>{terminationLabels[row.type]}</span>
                ),
              },
              {
                title: '退租日期',
                render: (_: unknown, row: LeaseSettlement) =>
                  day(row.terminatedAt),
              },
              {
                title: '结算净额',
                render: (_: unknown, row: LeaseSettlement) => {
                  const net = Number(row.netAmount);
                  return (
                    <span
                      style={{
                        color:
                          net > 0
                            ? 'var(--th-success)'
                            : net < 0
                              ? 'var(--th-danger)'
                              : undefined,
                        fontWeight: 500,
                      }}
                    >
                      {net > 0
                        ? `应收 ¥${money(net)}`
                        : net < 0
                          ? `应退 ¥${money(Math.abs(net))}`
                          : '结清'}
                    </span>
                  );
                },
              },
              {
                title: '状态',
                render: (_: unknown, row: LeaseSettlement) => (
                  <Tag color={statusColors[row.status]}>
                    {statusLabels[row.status]}
                  </Tag>
                ),
              },
              {
                title: '操作',
                fixed: 'right',
                render: (_: unknown, row: LeaseSettlement) => (
                  <div className="flex-start" style={{ gap: 8 }}>
                    <Button
                      type="link"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => openDetail(row)}
                    >
                      详情
                    </Button>
                    {canManageLease &&
                      row.status === 'PENDING' &&
                      Number(row.netAmount) !== 0 && (
                        <Button
                          type="link"
                          size="small"
                          icon={<CheckCircleOutlined />}
                          onClick={() => openPayment(row)}
                        >
                          {Number(row.netAmount) > 0 ? '收款' : '退款'}
                        </Button>
                      )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Spin>

      {/* 结算详情弹窗 */}
      <Modal
        title="退租结算详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={600}
      >
        {selected && (
          <DetailSection
            actions={
              canManageLease &&
              selected.status === 'PENDING' &&
              Number(selected.netAmount) !== 0 && (
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  onClick={() => {
                    setDetailOpen(false);
                    openPayment(selected);
                  }}
                >
                  {Number(selected.netAmount) > 0 ? '收款' : '退款'}
                </Button>
              )
            }
          >
            <Row gutter={[24, 0]}>
              <Col span={8}>
                <DetailItem label="房间">
                  {selected.room?.roomNo ?? '-'}
                </DetailItem>
              </Col>
              <Col span={8}>
                <DetailItem label="租客">
                  {selected.lease?.tenantName ?? '-'}
                </DetailItem>
              </Col>
              <Col span={8}>
                <DetailItem label="退租类型">
                  {terminationLabels[selected.type]}
                </DetailItem>
              </Col>
              <Col span={8}>
                <DetailItem label="退租日期">
                  {day(selected.terminatedAt)}
                </DetailItem>
              </Col>
              <Col span={8}>
                <DetailItem label="押金">
                  ¥{money(selected.depositAmount)}
                </DetailItem>
              </Col>
              <Col span={8}>
                <DetailItem label="押金扣款">
                  ¥{money(selected.depositDeductionAmount)}
                </DetailItem>
              </Col>
              <Col span={8}>
                <DetailItem label="押金退款">
                  ¥{money(selected.depositRefundAmount)}
                </DetailItem>
              </Col>
              <Col span={8}>
                <DetailItem label="房租调整">
                  ¥{money(selected.rentAdjustmentAmount)}
                </DetailItem>
              </Col>
              <Col span={8}>
                <DetailItem label="水电费">
                  ¥{money(selected.utilityAmount)}
                </DetailItem>
              </Col>
              <Col span={8}>
                <DetailItem label="其他费用">
                  ¥{money(selected.otherFeeAmount)}
                </DetailItem>
              </Col>
              <Col span={8}>
                <DetailItem label="应收合计">
                  ¥{money(selected.receivableAmount)}
                </DetailItem>
              </Col>
              <Col span={8}>
                <DetailItem label="应退合计">
                  ¥{money(selected.refundableAmount)}
                </DetailItem>
              </Col>
              <Col span={8}>
                <DetailItem label="结算净额">
                  <span style={{ fontWeight: 600 }}>
                    {Number(selected.netAmount) > 0
                      ? `应收 ¥${money(selected.netAmount)}`
                      : Number(selected.netAmount) < 0
                        ? `应退 ¥${money(Math.abs(Number(selected.netAmount)))}`
                        : '结清'}
                  </span>
                </DetailItem>
              </Col>
              <Col span={8}>
                <DetailItem label="状态">
                  <Tag color={statusColors[selected.status]}>
                    {statusLabels[selected.status]}
                  </Tag>
                </DetailItem>
              </Col>
            </Row>
          </DetailSection>
        )}
        {selected?.payments && selected.payments.length > 0 && (
          <div className={styles.paymentList}>
            <div className={styles.sectionTitle}>结算收付款记录</div>
            {selected.payments.map((p) => (
              <div key={p.id} className={styles.paymentItem}>
                <Tag color={p.direction === 'RECEIVE' ? 'success' : 'error'}>
                  {p.direction === 'RECEIVE' ? '收款' : '退款'}
                </Tag>
                <span className={styles.paymentAmount}>¥{money(p.amount)}</span>
                <span className="text-muted">{p.method}</span>
                <span className="text-muted">{day(p.paidAt)}</span>
                {p.note && <span className="text-muted">({p.note})</span>}
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* 收付款登记弹窗 */}
      <Modal
        title="结算收付款登记"
        open={paymentOpen}
        onCancel={() => {
          setPaymentOpen(false);
          paymentForm.resetFields();
        }}
        footer={null}
      >
        {selected && (
          <Form form={paymentForm} layout="vertical" onFinish={handlePayment}>
            <Form.Item label="结算单">
              <div>
                {selected.room?.roomNo} · {selected.lease?.tenantName}
              </div>
              <div className="text-muted">
                净额{' '}
                {Number(selected.netAmount) > 0
                  ? `应收 ¥${money(selected.netAmount)}`
                  : `应退 ¥${money(Math.abs(Number(selected.netAmount)))}`}
              </div>
            </Form.Item>
            <Form.Item
              label="方向"
              name="direction"
              rules={[{ required: true }]}
            >
              <Radio.Group
                options={[
                  { label: '收款', value: 'RECEIVE' },
                  { label: '退款', value: 'REFUND' },
                ]}
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
              <Input placeholder="如：微信、支付宝、银行转账" />
            </Form.Item>
            <Form.Item label="备注" name="note">
              <Input.TextArea rows={2} placeholder="可选" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={submitting}>
                确认登记
              </Button>
              <Button
                style={{ marginLeft: 12 }}
                onClick={() => {
                  setPaymentOpen(false);
                  paymentForm.resetFields();
                }}
              >
                取消
              </Button>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}
