import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  Form,
  DatePicker,
  InputNumber,
  Input,
  Button,
  message,
  Spin,
  Radio,
  Divider,
  Alert,
  Row,
  Col,
  Modal,
} from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { getRooms } from '@/api/rooms';
import {
  getSettlementPreview,
  terminateLease,
  recordSettlementPayment,
} from '@/api/leases';
import type { Room } from '@/types/domain';
import { money, today, numberValue } from '@/utils/format';
import { terminationLabels } from './constants';
import { computeSettlementPreview, defaultTerminationType } from './utils';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import DetailItem from '@/components/ui/DetailItem';
import styles from './LeaseTerminatePage.module.scss';

export default function LeaseTerminatePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageLease = useHasPermission('lease:manage');
  const [form] = Form.useForm();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [previousReadings, setPreviousReadings] = useState({
    previousWater: 0,
    previousPower: 0,
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [confirmValues, setConfirmValues] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [paymentForm] = Form.useForm();

  useEffect(() => {
    if (!currentOrgId) return;
    setLoading(true);
    getRooms(currentOrgId)
      .then((data) => setRooms(data))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [currentOrgId]);

  const room = useMemo(() => rooms.find((r) => r.id === id), [rooms, id]);
  const lease = useMemo(
    () => room?.leases?.find((l) => l.status === 'ACTIVE'),
    [room]
  );

  useEffect(() => {
    if (lease && currentOrgId) {
      const defaultType = defaultTerminationType(lease.endDate, today());
      form.setFieldsValue({
        type: defaultType,
        terminatedAt: dayjs(today()),
        reason: '',
        rentAdjustmentAmount: 0,
        currentWater: 0,
        currentPower: 0,
        otherFeeAmount: 0,
        otherFeeReason: '',
        penaltyAmount: 0,
        penaltyReason: '',
        compensationAmount: 0,
        compensationReason: '',
      });
      getSettlementPreview(currentOrgId!, lease.id, today())
        .then((data) =>
          setPreviousReadings({
            previousWater: Number(data.previousWater ?? 0),
            previousPower: Number(data.previousPower ?? 0),
          })
        )
        .catch((e) =>
          message.error(e instanceof Error ? e.message : '退租读数加载失败')
        );
    }
  }, [lease, currentOrgId, form]);

  const formValues = Form.useWatch([], form);

  const preview = useMemo(() => {
    if (!lease)
      return {
        utility: 0,
        depositRefund: 0,
        receivable: 0,
        refundable: 0,
        net: 0,
      };
    return computeSettlementPreview(
      lease,
      {
        rentAdjustmentAmount: String(formValues?.rentAdjustmentAmount ?? 0),
        currentWater: String(formValues?.currentWater ?? 0),
        currentPower: String(formValues?.currentPower ?? 0),
        otherFeeAmount: String(formValues?.otherFeeAmount ?? 0),
        penaltyAmount: String(formValues?.penaltyAmount ?? 0),
        compensationAmount: String(formValues?.compensationAmount ?? 0),
      },
      previousReadings
    );
  }, [lease, formValues, previousReadings]);

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!currentOrgId || !lease) return;
    if (!canManageLease) {
      message.warning('当前角色没有管理租约权限');
      return;
    }
    setConfirmValues(values);
    setConfirmOpen(true);
  };

  const handleConfirmTerminate = async () => {
    if (!currentOrgId || !lease || !confirmValues) return;
    setConfirmSubmitting(true);
    try {
      const result = await terminateLease(currentOrgId, lease.id, {
        type: String(confirmValues.type),
        reason:
          String(confirmValues.reason || '').trim() ||
          terminationLabels[
            String(confirmValues.type) as keyof typeof terminationLabels
          ],
        terminatedAt: dayjs(confirmValues.terminatedAt as string).format(
          'YYYY-MM-DD'
        ),
        rentAdjustmentAmount: numberValue(confirmValues.rentAdjustmentAmount),
        currentWater: numberValue(confirmValues.currentWater),
        currentPower: numberValue(confirmValues.currentPower),
        otherFeeAmount: numberValue(confirmValues.otherFeeAmount),
        otherFeeReason:
          String(confirmValues.otherFeeReason || '').trim() || undefined,
        penaltyAmount: numberValue(confirmValues.penaltyAmount),
        penaltyReason:
          String(confirmValues.penaltyReason || '').trim() || undefined,
        compensationAmount: numberValue(confirmValues.compensationAmount),
        compensationReason:
          String(confirmValues.compensationReason || '').trim() || undefined,
      });

      const paymentValues = paymentForm.getFieldsValue();
      const settlementId = result.settlement?.id;
      const paymentAmount = Number(paymentValues.paymentAmount || 0);
      if (settlementId && paymentAmount > 0 && paymentValues.paymentMethod) {
        await recordSettlementPayment(currentOrgId, settlementId, {
          direction: preview.net > 0 ? 'RECEIVE' : 'REFUND',
          amount: paymentAmount,
          method: String(paymentValues.paymentMethod),
          note: paymentValues.paymentNote
            ? String(paymentValues.paymentNote)
            : undefined,
        });
      }

      message.success('退租成功，已生成结算账单');
      setConfirmOpen(false);
      paymentForm.resetFields();
      navigate('/');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '退租失败');
    } finally {
      setConfirmSubmitting(false);
    }
  };

  const netColor =
    preview.net > 0
      ? 'var(--th-primary)'
      : preview.net < 0
        ? 'var(--th-danger)'
        : 'var(--th-foreground-muted)';

  return (
    <div className="page-content">
      <PageHeader
        back="/rooms"
        breadcrumb={[
          { label: '房间管理', path: '/rooms' },
          { label: '退租结算' },
        ]}
      />

      <Spin spinning={loading}>
        <div className={styles.leaseTerminateContainer}>
          {lease ? (
            <>
              <Card>
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                  <Divider orientation="left" className={styles.sectionDivider}>
                    退租信息
                  </Divider>
                  <div className={styles.formGrid2}>
                    <Form.Item
                      label="退租类型"
                      name="type"
                      rules={[{ required: true }]}
                    >
                      <Radio.Group
                        options={[
                          {
                            label: terminationLabels.EXPIRED,
                            value: 'EXPIRED',
                          },
                          {
                            label: terminationLabels.NEGOTIATED,
                            value: 'NEGOTIATED',
                          },
                          { label: terminationLabels.BREACH, value: 'BREACH' },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item
                      label="退租日期"
                      name="terminatedAt"
                      rules={[{ required: true }]}
                    >
                      <DatePicker
                        className="w-full"
                        prefix={<CalendarOutlined />}
                      />
                    </Form.Item>
                  </div>

                  <Divider orientation="left" className={styles.sectionDivider}>
                    房租结算
                  </Divider>
                  <Form.Item label="房租退补" name="rentAdjustmentAmount">
                    <InputNumber
                      className="w-full"
                      prefix="¥"
                      placeholder="正数补收，负数退款"
                    />
                  </Form.Item>

                  <Divider orientation="left" className={styles.sectionDivider}>
                    水电结算
                  </Divider>
                  <div className={styles.formGrid2}>
                    <Form.Item
                      label={`退租水表读数（上次 ${money(previousReadings.previousWater)}）`}
                      name="currentWater"
                    >
                      <InputNumber min={0} className="w-full" />
                    </Form.Item>
                    <Form.Item
                      label={`退租电表读数（上次 ${money(previousReadings.previousPower)}）`}
                      name="currentPower"
                    >
                      <InputNumber min={0} className="w-full" />
                    </Form.Item>
                  </div>
                  <Row gutter={[24, 0]} className="mb-16">
                    <Col span={8}>
                      <DetailItem label="预估水电费">
                        <span style={{ color: 'var(--th-warning)' }}>
                          ¥{money(preview.utility)}
                        </span>
                      </DetailItem>
                    </Col>
                  </Row>

                  <Divider orientation="left" className={styles.sectionDivider}>
                    押金处理
                  </Divider>
                  {Number(lease.deposit?.paidAmount ?? 0) === 0 ? (
                    <Alert
                      message="押金未收取"
                      type="warning"
                      showIcon
                      className="mb-16"
                    />
                  ) : (
                    <Row gutter={[24, 0]} className="mb-16">
                      <Col span={12}>
                        <DetailItem label="约定押金">
                          ¥{money(lease.depositAmount)}
                        </DetailItem>
                      </Col>
                      <Col span={12}>
                        <DetailItem label="已收押金">
                          ¥{money(lease.deposit?.paidAmount ?? 0)}
                        </DetailItem>
                      </Col>
                    </Row>
                  )}

                  <Divider orientation="left" className={styles.sectionDivider}>
                    违约与赔偿
                  </Divider>
                  <div className={styles.formGrid2}>
                    <Form.Item label="违约金" name="penaltyAmount">
                      <InputNumber min={0} className="w-full" prefix="¥" />
                    </Form.Item>
                    <Form.Item label="违约金说明" name="penaltyReason">
                      <Input
                        placeholder="可选"
                        prefix={<InfoCircleOutlined />}
                      />
                    </Form.Item>
                  </div>
                  <div className={styles.formGrid2}>
                    <Form.Item label="赔偿金" name="compensationAmount">
                      <InputNumber min={0} className="w-full" prefix="¥" />
                    </Form.Item>
                    <Form.Item label="赔偿金说明" name="compensationReason">
                      <Input
                        placeholder="可选"
                        prefix={<InfoCircleOutlined />}
                      />
                    </Form.Item>
                  </div>
                  <Divider orientation="left" className={styles.sectionDivider}>
                    其他费用
                  </Divider>
                  <div className={styles.formGrid2}>
                    <Form.Item label="其他费用" name="otherFeeAmount">
                      <InputNumber min={0} className="w-full" prefix="¥" />
                    </Form.Item>
                    <Form.Item label="其他费用说明" name="otherFeeReason">
                      <Input
                        placeholder="可选"
                        prefix={<InfoCircleOutlined />}
                      />
                    </Form.Item>
                  </div>

                  <Divider orientation="left" className={styles.sectionDivider}>
                    结算预览
                  </Divider>
                  <div className={styles.settlementPreview}>
                    <Row gutter={[24, 0]}>
                      <Col span={8}>
                        <DetailItem label="应收">
                          ¥{money(preview.receivable)}
                        </DetailItem>
                      </Col>
                      <Col span={8}>
                        <DetailItem label="应退">
                          ¥{money(preview.refundable)}
                        </DetailItem>
                      </Col>
                      <Col span={8}>
                        <DetailItem label="结算结果">
                          <span
                            style={{
                              color: netColor,
                              fontWeight: 600,
                            }}
                          >
                            {preview.net > 0
                              ? `租客补交 ¥${money(preview.net)}`
                              : preview.net < 0
                                ? `退租客 ¥${money(Math.abs(preview.net))}`
                                : '结清'}
                          </span>
                        </DetailItem>
                      </Col>
                    </Row>
                  </div>

                  <Form.Item label="退租原因" name="reason">
                    <Input.TextArea rows={2} placeholder="可选" />
                  </Form.Item>

                  {lease.isAutoRenewalPeriod && (
                    <Alert
                      message="当前租约已进入自动续约期，到期后退房不默认视为违约。"
                      type="info"
                      showIcon
                      className="mb-16"
                    />
                  )}

                  <Form.Item className={styles.formActions}>
                    <Button
                      type="primary"
                      danger
                      htmlType="submit"
                      icon={<CheckOutlined />}
                      loading={false}
                    >
                      确认终止合约
                    </Button>
                    <Button
                      className={styles.cancelBtn}
                      onClick={() => navigate('/rooms')}
                    >
                      取消
                    </Button>
                  </Form.Item>
                </Form>
              </Card>

              <Modal
                title="确认结清"
                open={confirmOpen}
                onCancel={() => setConfirmOpen(false)}
                footer={null}
                destroyOnClose
                width={560}
              >
                <div className={styles.confirmModal}>
                  <Divider orientation="left" className={styles.sectionDivider}>
                    退租信息
                  </Divider>
                  <Row gutter={[24, 0]}>
                    <Col span={12}>
                      <DetailItem label="退租类型">
                        {
                          terminationLabels[
                            String(
                              confirmValues?.type
                            ) as keyof typeof terminationLabels
                          ]
                        }
                      </DetailItem>
                    </Col>
                    <Col span={12}>
                      <DetailItem label="退租日期">
                        {dayjs(confirmValues?.terminatedAt as string).format(
                          'YYYY-MM-DD'
                        )}
                      </DetailItem>
                    </Col>
                  </Row>

                  <Divider orientation="left" className={styles.sectionDivider}>
                    结算明细
                  </Divider>
                  <div className={styles.confirmDetailList}>
                    {Number(confirmValues?.rentAdjustmentAmount ?? 0) !== 0 && (
                      <div className={styles.confirmDetailItem}>
                        <span>房租退补</span>
                        <span
                          className={
                            Number(confirmValues?.rentAdjustmentAmount) > 0
                              ? styles.amountReceivable
                              : styles.amountRefundable
                          }
                        >
                          {Number(confirmValues?.rentAdjustmentAmount) > 0
                            ? '+'
                            : ''}
                          ¥
                          {money(
                            Number(confirmValues?.rentAdjustmentAmount ?? 0)
                          )}
                        </span>
                      </div>
                    )}
                    {preview.utility > 0 && (
                      <div className={styles.confirmDetailItem}>
                        <span>水电费</span>
                        <span className={styles.amountReceivable}>
                          +¥{money(preview.utility)}
                        </span>
                      </div>
                    )}
                    {Number(confirmValues?.penaltyAmount ?? 0) > 0 && (
                      <div className={styles.confirmDetailItem}>
                        <span>违约金</span>
                        <span className={styles.amountReceivable}>
                          +¥{money(Number(confirmValues?.penaltyAmount ?? 0))}
                        </span>
                      </div>
                    )}
                    {Number(confirmValues?.compensationAmount ?? 0) > 0 && (
                      <div className={styles.confirmDetailItem}>
                        <span>赔偿金</span>
                        <span className={styles.amountReceivable}>
                          +¥
                          {money(
                            Number(confirmValues?.compensationAmount ?? 0)
                          )}
                        </span>
                      </div>
                    )}
                    {Number(confirmValues?.otherFeeAmount ?? 0) > 0 && (
                      <div className={styles.confirmDetailItem}>
                        <span>其他费用</span>
                        <span className={styles.amountReceivable}>
                          +¥{money(Number(confirmValues?.otherFeeAmount ?? 0))}
                        </span>
                      </div>
                    )}
                  </div>

                  <Divider orientation="left" className={styles.sectionDivider}>
                    结算汇总
                  </Divider>
                  <div className={styles.settlementPreview}>
                    <Row gutter={[24, 0]}>
                      <Col span={8}>
                        <DetailItem label="应收">
                          <span style={{ color: 'var(--th-primary)' }}>
                            ¥{money(preview.receivable)}
                          </span>
                        </DetailItem>
                      </Col>
                      <Col span={8}>
                        <DetailItem label="应退">
                          <span style={{ color: 'var(--th-danger)' }}>
                            ¥{money(preview.refundable)}
                          </span>
                        </DetailItem>
                      </Col>
                      <Col span={8}>
                        <DetailItem label="结算结果">
                          <span
                            style={{
                              color: netColor,
                              fontWeight: 600,
                            }}
                          >
                            {preview.net > 0
                              ? `租客补交 ¥${money(preview.net)}`
                              : preview.net < 0
                                ? `退租客 ¥${money(Math.abs(preview.net))}`
                                : '结清'}
                          </span>
                        </DetailItem>
                      </Col>
                    </Row>
                  </div>

                  <Divider style={{ margin: '16px 0' }} />
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ margin: '0 0 8px', fontWeight: 500 }}>
                      结算收/退款
                    </h4>
                    <Form
                      form={paymentForm}
                      layout="inline"
                      style={{ alignItems: 'flex-start' }}
                    >
                      <Form.Item
                        label={
                          preview.net > 0
                            ? '收款金额'
                            : preview.net < 0
                              ? '退款金额'
                              : '金额'
                        }
                        name="paymentAmount"
                        initialValue={Math.abs(preview.net)}
                        rules={[
                          {
                            required: preview.net !== 0,
                            message: '请输入金额',
                          },
                        ]}
                      >
                        <InputNumber
                          prefix="¥"
                          min={0}
                          precision={2}
                          style={{ width: 160 }}
                          disabled={preview.net === 0}
                        />
                      </Form.Item>
                      <Form.Item
                        label="方式"
                        name="paymentMethod"
                        rules={[
                          {
                            required: preview.net !== 0,
                            message: '请选择方式',
                          },
                        ]}
                      >
                        <select
                          className="ant-select"
                          style={{
                            width: 120,
                            height: 32,
                            borderRadius: 6,
                            padding: '0 8px',
                            border: '1px solid #d9d9d9',
                          }}
                          disabled={preview.net === 0}
                          defaultValue=""
                        >
                          <option value="">请选择</option>
                          <option value="CASH">现金</option>
                          <option value="BANK_TRANSFER">银行转账</option>
                          <option value="WECHAT">微信</option>
                          <option value="ALIPAY">支付宝</option>
                        </select>
                      </Form.Item>
                      <Form.Item label="备注" name="paymentNote">
                        <Input placeholder="选填" style={{ width: 200 }} />
                      </Form.Item>
                    </Form>
                  </div>

                  <Alert
                    message="确认结清后将完成退租，请确认已收到结算款项或完成退款"
                    type="warning"
                    showIcon
                    className="mb-16"
                  />

                  <div className={styles.confirmActions}>
                    <Button
                      type="primary"
                      danger
                      loading={confirmSubmitting}
                      disabled={confirmSubmitting}
                      onClick={handleConfirmTerminate}
                    >
                      确认结清
                    </Button>
                    <Button
                      className={styles.cancelBtn}
                      onClick={() => setConfirmOpen(false)}
                      disabled={confirmSubmitting}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              </Modal>
            </>
          ) : (
            <EmptyState
              title="租约不存在或已结束"
              description="当前房间没有有效的租约可供退租结算"
              action={{
                label: '返回房间列表',
                onClick: () => navigate('/rooms'),
              }}
            />
          )}
        </div>
      </Spin>
    </div>
  );
}
