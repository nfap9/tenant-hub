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
import { getSettlementPreview, terminateLease } from '@/api/leases';
import type { Room } from '@/types/domain';
import { money, today, numberValue } from '@/utils/format';
import { terminationLabels } from './constants';
import {
  computeSettlementPreview,
  defaultTerminationType,
  terminationResultText,
} from './utils';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';

export default function LeaseTerminatePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageLease = useHasPermission('lease:manage');
  const [form] = Form.useForm();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previousReadings, setPreviousReadings] = useState({
    previousWater: 0,
    previousPower: 0,
  });

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
        depositDeductionAmount: 0,
        depositDeductionReason: '',
        rentAdjustmentAmount: 0,
        currentWater: 0,
        currentPower: 0,
        otherFeeAmount: 0,
        otherFeeReason: '',
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

  const formValues = form.getFieldsValue(true);

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
        depositDeductionAmount: String(formValues.depositDeductionAmount ?? 0),
        rentAdjustmentAmount: String(formValues.rentAdjustmentAmount ?? 0),
        currentWater: String(formValues.currentWater ?? 0),
        currentPower: String(formValues.currentPower ?? 0),
        otherFeeAmount: String(formValues.otherFeeAmount ?? 0),
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

    setSubmitting(true);
    try {
      const settlement = await terminateLease(currentOrgId, lease.id, {
        type: String(values.type),
        reason:
          String(values.reason || '').trim() ||
          terminationLabels[
            String(values.type) as keyof typeof terminationLabels
          ],
        terminatedAt: dayjs(values.terminatedAt as string).format('YYYY-MM-DD'),
        depositDeductionAmount: numberValue(values.depositDeductionAmount),
        depositDeductionReason:
          String(values.depositDeductionReason || '').trim() || undefined,
        rentAdjustmentAmount: numberValue(values.rentAdjustmentAmount),
        currentWater: numberValue(values.currentWater),
        currentPower: numberValue(values.currentPower),
        otherFeeAmount: numberValue(values.otherFeeAmount),
        otherFeeReason: String(values.otherFeeReason || '').trim() || undefined,
      });
      const net = Number(
        (settlement as { netAmount: string | number }).netAmount
      );
      message.success(terminationResultText(net));
      navigate('/rooms');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '退租失败');
    } finally {
      setSubmitting(false);
    }
  };

  const netColor =
    preview.net > 0
      ? 'var(--th-success)'
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
        <div style={{ maxWidth: 720 }}>
          <Card>
            {lease ? (
              <Form form={form} layout="vertical" onFinish={handleSubmit}>
                <Form.Item
                  label="退租类型"
                  name="type"
                  rules={[{ required: true }]}
                >
                  <Radio.Group
                    options={[
                      { label: terminationLabels.EXPIRED, value: 'EXPIRED' },
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
                    style={{ width: '100%' }}
                    size="large"
                    prefix={<CalendarOutlined />}
                  />
                </Form.Item>

                <Divider
                  orientation="left"
                  style={{
                    color: 'var(--th-foreground-muted)',
                    fontWeight: 600,
                  }}
                >
                  押金与房租
                </Divider>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                    padding: '0 8px',
                    color: 'var(--th-foreground-muted)',
                  }}
                >
                  <span>原押金</span>
                  <span
                    style={{ fontWeight: 500, color: 'var(--th-foreground)' }}
                  >
                    ¥{money(lease.depositAmount)}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                    padding: '0 8px',
                    color: 'var(--th-foreground-muted)',
                  }}
                >
                  <span>预计退押金</span>
                  <span style={{ fontWeight: 500, color: 'var(--th-success)' }}>
                    ¥{money(preview.depositRefund)}
                  </span>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 16,
                  }}
                >
                  <Form.Item label="押金扣款" name="depositDeductionAmount">
                    <InputNumber
                      min={0}
                      style={{ width: '100%' }}
                      prefix="¥"
                      size="large"
                    />
                  </Form.Item>
                  <Form.Item label="房租退补" name="rentAdjustmentAmount">
                    <InputNumber
                      style={{ width: '100%' }}
                      prefix="¥"
                      placeholder="正数补收，负数退款"
                      size="large"
                    />
                  </Form.Item>
                </div>
                <Form.Item label="押金扣款原因" name="depositDeductionReason">
                  <Input
                    placeholder="可选"
                    size="large"
                    prefix={<InfoCircleOutlined />}
                  />
                </Form.Item>

                <Divider
                  orientation="left"
                  style={{
                    color: 'var(--th-foreground-muted)',
                    fontWeight: 600,
                  }}
                >
                  水电读数
                </Divider>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 16,
                  }}
                >
                  <Form.Item
                    label={`退租水表读数（上次 ${money(previousReadings.previousWater)}）`}
                    name="currentWater"
                  >
                    <InputNumber
                      min={0}
                      style={{ width: '100%' }}
                      size="large"
                    />
                  </Form.Item>
                  <Form.Item
                    label={`退租电表读数（上次 ${money(previousReadings.previousPower)}）`}
                    name="currentPower"
                  >
                    <InputNumber
                      min={0}
                      style={{ width: '100%' }}
                      size="large"
                    />
                  </Form.Item>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                    padding: '0 8px',
                    color: 'var(--th-foreground-muted)',
                  }}
                >
                  <span>预估水电费</span>
                  <span style={{ fontWeight: 500, color: 'var(--th-warning)' }}>
                    ¥{money(preview.utility)}
                  </span>
                </div>

                <Form.Item label="其他费用" name="otherFeeAmount">
                  <InputNumber
                    min={0}
                    style={{ width: '100%' }}
                    prefix="¥"
                    size="large"
                  />
                </Form.Item>
                <Form.Item label="其他费用说明" name="otherFeeReason">
                  <Input
                    placeholder="可选"
                    size="large"
                    prefix={<InfoCircleOutlined />}
                  />
                </Form.Item>

                <Divider
                  orientation="left"
                  style={{
                    color: 'var(--th-foreground-muted)',
                    fontWeight: 600,
                  }}
                >
                  结算预览
                </Divider>
                <div
                  style={{
                    background: 'var(--th-surface-hover)',
                    padding: 16,
                    borderRadius: 'var(--th-radius-sm)',
                    marginBottom: 16,
                    border: '1px solid var(--th-border-light)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                      color: 'var(--th-foreground-muted)',
                    }}
                  >
                    <span>应收</span>
                    <span
                      style={{ fontWeight: 500, color: 'var(--th-foreground)' }}
                    >
                      ¥{money(preview.receivable)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                      color: 'var(--th-foreground-muted)',
                    }}
                  >
                    <span>应退</span>
                    <span
                      style={{ fontWeight: 500, color: 'var(--th-foreground)' }}
                    >
                      ¥{money(preview.refundable)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      paddingTop: 8,
                      borderTop: '1px solid var(--th-border)',
                      color: 'var(--th-foreground-muted)',
                    }}
                  >
                    <span>结算结果</span>
                    <span style={{ fontWeight: 600, color: netColor }}>
                      {preview.net > 0
                        ? `租客补交 ¥${money(preview.net)}`
                        : preview.net < 0
                          ? `退租客 ¥${money(Math.abs(preview.net))}`
                          : '结清'}
                    </span>
                  </div>
                </div>

                <Form.Item label="退租原因" name="reason">
                  <Input.TextArea rows={2} placeholder="可选" />
                </Form.Item>

                {lease.isAutoRenewalPeriod && (
                  <Alert
                    message="当前租约已进入自动续约期，到期后退房不默认视为违约。"
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                )}

                <Form.Item style={{ marginTop: 24 }}>
                  <Button
                    type="primary"
                    danger
                    htmlType="submit"
                    icon={<CheckOutlined />}
                    loading={submitting}
                    disabled={submitting}
                    size="large"
                  >
                    确认终止合约
                  </Button>
                  <Button
                    size="large"
                    style={{ marginLeft: 12 }}
                    onClick={() => navigate('/rooms')}
                  >
                    取消
                  </Button>
                </Form.Item>
              </Form>
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
          </Card>
        </div>
      </Spin>
    </div>
  );
}
