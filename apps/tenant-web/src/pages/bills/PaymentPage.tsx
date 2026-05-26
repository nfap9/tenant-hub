import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Select, Form, Spin, message, Checkbox } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { getBills, createPayment } from '@/api/bills';
import { getLeases } from '@/api/leases';
import { money, day } from '@/utils/format';
import { statusLabels, billModeText } from './constants';
import { remainingAmount } from './utils';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import type { Bill, Lease } from '@/types/domain';
import styles from './PaymentPage.module.scss';

export default function PaymentPage() {
  const { currentOrgId } = useAppSession();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [leases, setLeases] = useState<Lease[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string>('');
  const [selectedBillIds, setSelectedBillIds] = useState<Set<string>>(
    new Set()
  );
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

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
    loadData();
  }, [currentOrgId]);

  const leaseOptions = useMemo(() => {
    return leases
      .filter((l) => l.status === 'ACTIVE')
      .map((l) => ({
        label: `${l.tenantName} · ${l.room?.roomNo ?? '房间'}`,
        value: l.id,
      }));
  }, [leases]);

  const leaseBills = useMemo(() => {
    if (!selectedLeaseId) return [];
    return bills
      .filter(
        (b) =>
          b.leaseId === selectedLeaseId &&
          (b.status === 'UNPAID' || b.status === 'PARTIAL_PAID')
      )
      .sort(
        (a, b) =>
          new Date(a.billingDate).getTime() - new Date(b.billingDate).getTime()
      );
  }, [bills, selectedLeaseId]);

  const selectedBills = useMemo(
    () => leaseBills.filter((b) => selectedBillIds.has(b.id)),
    [leaseBills, selectedBillIds]
  );

  const totalPayable = useMemo(
    () => selectedBills.reduce((sum, b) => sum + remainingAmount(b), 0),
    [selectedBills]
  );

  const detailItems = useMemo(() => {
    const items: { name: string; amount: number }[] = [];
    for (const bill of selectedBills) {
      for (const item of bill.items ?? []) {
        items.push({
          name: `${bill.billingDate.slice(0, 10)} ${item.name}`,
          amount: Number(item.amount),
        });
      }
    }
    return items;
  }, [selectedBills]);

  const toggleBill = (billId: string) => {
    setSelectedBillIds((prev) => {
      const next = new Set(prev);
      if (next.has(billId)) {
        next.delete(billId);
      } else {
        next.add(billId);
      }
      return next;
    });
  };

  const handleLeaseChange = (leaseId: string) => {
    setSelectedLeaseId(leaseId);
    setSelectedBillIds(new Set());
    form.setFieldsValue({ amount: undefined });
  };

  const handleSubmit = async (values: {
    amount: string;
    method: string;
    note?: string;
  }) => {
    if (!currentOrgId || selectedBills.length === 0) return;

    const paidAmount = Number(values.amount);
    if (paidAmount !== totalPayable) {
      message.error(`实付金额必须等于应付金额 ¥${money(totalPayable)}`);
      return;
    }

    setSubmitting(true);
    try {
      for (const bill of selectedBills) {
        const billRemaining = remainingAmount(bill);
        if (billRemaining <= 0) continue;
        await createPayment(currentOrgId, {
          billId: bill.id,
          amount: billRemaining,
          method: values.method.trim() || '线下收款',
          note: values.note?.trim() || undefined,
          paidAt: new Date().toISOString(),
        });
      }
      message.success('收款已登记');
      navigate('/bills');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '收款失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-content">
      <PageHeader
        back={true}
        breadcrumb={[
          { label: '财务管理', path: '/bills' },
          { label: '登记收款' },
        ]}
      />

      <Spin spinning={loading}>
        <div className={styles.paymentLayout}>
          {/* 左侧：租约选择 + 账单选择 */}
          <div className={styles.paymentPanel}>
            <div className={styles.paymentPanelTitle}>选择账单</div>

            <Select
              className={styles.leaseSelect}
              placeholder="选择租约"
              value={selectedLeaseId || undefined}
              onChange={handleLeaseChange}
              options={leaseOptions}
              showSearch
              optionFilterProp="label"
            />

            {!selectedLeaseId ? (
              <EmptyState size="small" description="请先选择租约" />
            ) : leaseBills.length === 0 ? (
              <EmptyState size="small" description="该租约暂无待支付账单" />
            ) : (
              <div className={styles.billList}>
                {leaseBills.map((bill) => {
                  const checked = selectedBillIds.has(bill.id);
                  return (
                    <div
                      key={bill.id}
                      className={`${styles.billOption} ${checked ? styles.billOptionSelected : ''}`}
                      onClick={() => toggleBill(bill.id)}
                    >
                      <Checkbox checked={checked} />
                      <div className={styles.billOptionInfo}>
                        <div className={styles.billOptionTitle}>
                          {bill.billingDate.slice(0, 10)} ·{' '}
                          {billModeText(bill.mode)}
                        </div>
                        <div className={styles.billOptionMeta}>
                          {statusLabels[bill.status]} · {day(bill.periodStart)}{' '}
                          至 {day(bill.periodEnd)}
                        </div>
                      </div>
                      <div className={styles.billOptionAmount}>
                        ¥{money(remainingAmount(bill))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 右侧：账单明细 + 收款信息 */}
          <div className={styles.paymentPanel}>
            <div className={styles.paymentPanelTitle}>收款确认</div>

            {selectedBills.length === 0 ? (
              <EmptyState size="small" description="请在左侧选择要收款的账单" />
            ) : (
              <Form form={form} layout="vertical" onFinish={handleSubmit}>
                {/* 明细 */}
                <div className={styles.detailSection}>
                  <div className={styles.detailSectionTitle}>
                    账单明细（{selectedBills.length} 笔）
                  </div>
                  {detailItems.map((item, idx) => (
                    <div key={idx} className={styles.detailItem}>
                      <span className={styles.detailItemName}>{item.name}</span>
                      <span className={styles.detailItemAmount}>
                        ¥{money(item.amount)}
                      </span>
                    </div>
                  ))}
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryLabel}>应付金额</span>
                    <span className={styles.summaryAmount}>
                      ¥{money(totalPayable)}
                    </span>
                  </div>
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
                        return Promise.resolve();
                      },
                    },
                  ]}
                >
                  <Input prefix="¥" placeholder={`${money(totalPayable)}`} />
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
    </div>
  );
}
