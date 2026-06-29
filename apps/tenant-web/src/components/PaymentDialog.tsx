import { useState, useMemo, useEffect } from 'react';
import {
  Button,
  Input,
  Select,
  Form,
  Spin,
  message,
  Modal,
  Checkbox,
} from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { getBills, createLeasePayment } from '@/api/bills';
import { getLeases } from '@/api/leases';
import { money, day } from '@/utils/format';
import { remainingAmount } from '@/pages/bills/utils';
import EmptyState from '@/components/ui/EmptyState';
import type { Bill, Lease } from '@/types/domain';

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultLeaseId?: string;
}

export default function PaymentDialog({
  open,
  onClose,
  onSuccess,
  defaultLeaseId,
}: PaymentDialogProps) {
  const { currentOrgId } = useAppSession();
  const [form] = Form.useForm();

  const [leases, setLeases] = useState<Lease[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string>(
    defaultLeaseId ?? ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  const amountValue = Form.useWatch('amount', form);
  const waiverChecked = Form.useWatch('waiver', form);

  const round2 = (value: number) => Math.round(value * 100) / 100;

  const paidAmount = useMemo(() => {
    const num = Number(amountValue);
    return Number.isFinite(num) ? num : 0;
  }, [amountValue]);

  const loadData = async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const [nextLeases, nextBills] = await Promise.all([
        getLeases(currentOrgId),
        getBills(currentOrgId),
      ]);
      setLeases(nextLeases);
      setBills(nextBills);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadData();
      if (defaultLeaseId) {
        setSelectedLeaseId(defaultLeaseId);
      }
    } else {
      setSelectedLeaseId(defaultLeaseId ?? '');
      form.resetFields();
    }
  }, [open, defaultLeaseId]);

  const leaseOptions = useMemo(() => {
    return leases
      .filter((l) => l.status === 'ACTIVE')
      .map((l) => ({
        label: `${l.room?.apartment?.name ?? '公寓'} · ${
          l.room?.roomNo ?? '房间'
        }`,
        value: l.id,
      }));
  }, [leases]);

  const selectedLease = useMemo(
    () => leases.find((l) => l.id === selectedLeaseId),
    [leases, selectedLeaseId]
  );

  const leaseBills = useMemo(() => {
    if (!selectedLeaseId) return [];
    return bills
      .filter((b) => b.leaseId === selectedLeaseId && b.status === 'UNPAID')
      .sort(
        (a, b) =>
          new Date(a.billingDate).getTime() - new Date(b.billingDate).getTime()
      );
  }, [bills, selectedLeaseId]);

  const totalRemaining = useMemo(
    () => leaseBills.reduce((sum, b) => sum + remainingAmount(b), 0),
    [leaseBills]
  );

  const waiverAmount = useMemo(() => {
    if (!waiverChecked) return 0;
    return round2(totalRemaining - paidAmount);
  }, [waiverChecked, totalRemaining, paidAmount]);

  const billItemRows = useMemo(() => {
    return leaseBills.flatMap((bill) =>
      (bill.items ?? []).map((item) => ({
        name: item.name,
        amount: Number(item.amount),
        period: `${day(item.periodStart)} ~ ${day(item.periodEnd)}`,
      }))
    );
  }, [leaseBills]);

  const handleLeaseChange = (leaseId: string) => {
    setSelectedLeaseId(leaseId);
    form.setFieldsValue({ amount: undefined });
  };

  const handleSubmit = async (values: {
    amount: string;
    method: string;
    note?: string;
    waiver?: boolean;
  }) => {
    if (!currentOrgId || !selectedLeaseId) return;

    const paid = Number(values.amount);
    if (paid <= 0 || paid > totalRemaining) {
      message.error('实付金额不合法');
      return;
    }

    const waiver = values.waiver ? round2(totalRemaining - paid) : 0;
    if (values.waiver) {
      if (waiver > 1) {
        message.error('抹零金额不能超过 1 元');
        return;
      }
      if (waiver < 0) {
        message.error('抹零金额不能为负数');
        return;
      }
      if (Math.abs(paid + waiver - totalRemaining) > 0.01) {
        message.error('实付金额与抹零金额之和应等于剩余应收');
        return;
      }
    }

    setSubmitting(true);
    try {
      await createLeasePayment(currentOrgId, {
        leaseId: selectedLeaseId,
        amount: paid,
        waiverAmount: values.waiver ? waiver : undefined,
        method: values.method.trim() || '线下收款',
        note: values.note?.trim() || undefined,
        paidAt: new Date().toISOString(),
      });
      message.success('收款已登记');
      onSuccess?.();
      onClose();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '收款失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="登记收款"
      open={open}
      onCancel={onClose}
      width={900}
      footer={null}
      destroyOnClose
    >
      <Spin spinning={loading}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 24,
            marginTop: 16,
          }}
        >
          {/* 左侧：租约选择 + 未付账单列表 */}
          <div>
            <div
              style={{
                fontWeight: 600,
                fontSize: 15,
                marginBottom: 16,
              }}
            >
              选择租约
            </div>

            <Select
              style={{ width: '100%', marginBottom: 16 }}
              placeholder="选择租约"
              value={selectedLeaseId || undefined}
              onChange={handleLeaseChange}
              options={leaseOptions}
              showSearch
              optionFilterProp="label"
            />

            {!selectedLeaseId ? (
              <EmptyState size="small" description="请先选择租约" />
            ) : (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {selectedLease && (
                  <div
                    style={{
                      padding: 12,
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      marginBottom: 12,
                      background: '#fafafa',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        marginBottom: 8,
                      }}
                    >
                      租约信息
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '4px 16px',
                        fontSize: 13,
                        color: '#374151',
                      }}
                    >
                      <div>租客：{selectedLease.tenantName || '未知租客'}</div>
                      <div>手机：{selectedLease.tenantPhone || '-'}</div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        租金：¥{money(selectedLease.rentAmount)}/月
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        费用项目：
                        {(selectedLease.fees ?? []).length === 0
                          ? '无'
                          : selectedLease.fees
                              ?.map(
                                (fee) => `${fee.name} ¥${money(fee.amount)}`
                              )
                              .join('、')}
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        租期：{day(selectedLease.startDate)} 至{' '}
                        {day(selectedLease.endDate)}
                      </div>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    marginBottom: 8,
                  }}
                >
                  账单信息
                </div>

                {billItemRows.length === 0 ? (
                  <EmptyState size="small" description="该租约暂无待支付账单" />
                ) : (
                  <div
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      padding: '0 12px',
                    }}
                  >
                    {billItemRows.map((row, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 16,
                          padding: '10px 0',
                          fontSize: 13,
                          borderBottom:
                            idx < billItemRows.length - 1
                              ? '1px solid #e5e7eb'
                              : undefined,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span style={{ minWidth: 80 }}>{row.name}</span>
                        <span
                          style={{
                            flex: 1,
                            textAlign: 'right',
                            color: '#6b7280',
                          }}
                        >
                          {row.period}
                        </span>
                        <span
                          style={{
                            minWidth: 80,
                            textAlign: 'right',
                            fontWeight: 500,
                          }}
                        >
                          ¥{money(row.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 右侧：收款信息 */}
          <div>
            <div
              style={{
                fontWeight: 600,
                fontSize: 15,
                marginBottom: 16,
              }}
            >
              收款确认
            </div>

            {selectedLeaseId && leaseBills.length === 0 ? (
              <EmptyState size="small" description="该租约暂无待支付账单" />
            ) : !selectedLeaseId ? (
              <EmptyState size="small" description="请先选择租约" />
            ) : (
              <Form form={form} layout="vertical" onFinish={handleSubmit}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px 0',
                    borderBottom: '2px solid #e5e7eb',
                    marginBottom: 20,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 15,
                    }}
                  >
                    剩余应收
                  </span>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 20,
                      color: '#3b82f6',
                    }}
                  >
                    ¥{money(totalRemaining)}
                  </span>
                </div>

                {/* 收款信息 */}
                <Form.Item
                  name="amount"
                  label="实付金额"
                  rules={[
                    { required: true, message: '请输入实付金额' },
                    {
                      validator: (_, value) => {
                        if (!value) return Promise.resolve();
                        const num = Number(value);
                        if (!Number.isFinite(num) || num <= 0) {
                          return Promise.reject(new Error('金额必须大于 0'));
                        }
                        if (totalRemaining > 0 && num > totalRemaining) {
                          return Promise.reject(
                            new Error(
                              `金额不能超过剩余应收 ¥${money(totalRemaining)}`
                            )
                          );
                        }
                        return Promise.resolve();
                      },
                    },
                  ]}
                >
                  <Input prefix="¥" placeholder={`${money(totalRemaining)}`} />
                </Form.Item>

                <Form.Item
                  name="method"
                  label="收款方式"
                  initialValue="线下收款"
                  rules={[{ required: true, message: '请选择收款方式' }]}
                >
                  <Select
                    options={[
                      { label: '线下收款', value: '线下收款' },
                      { label: '现金', value: '现金' },
                      { label: '微信', value: '微信' },
                      { label: '支付宝', value: '支付宝' },
                      { label: '银行转账', value: '银行转账' },
                    ]}
                  />
                </Form.Item>

                <Form.Item
                  name="waiver"
                  valuePropName="checked"
                  initialValue={false}
                >
                  <Checkbox disabled={totalRemaining <= 0}>
                    抹零（未收金额最多豁免 1 元并记为已结清）
                  </Checkbox>
                </Form.Item>

                {waiverChecked && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 0',
                      borderBottom: '1px solid #e5e7eb',
                      marginBottom: 20,
                      color: waiverAmount > 1 ? '#ef4444' : undefined,
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>抹零金额</span>
                    <span style={{ fontWeight: 600, fontSize: 16 }}>
                      ¥{money(waiverAmount)}
                    </span>
                  </div>
                )}

                <Form.Item name="note" label="备注">
                  <Input.TextArea placeholder="备注（可选）" rows={2} />
                </Form.Item>

                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    loading={submitting}
                    block
                  >
                    确认收款
                  </Button>
                </Form.Item>
              </Form>
            )}
          </div>
        </div>
      </Spin>
    </Modal>
  );
}
