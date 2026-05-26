import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Tag,
  Input,
  Select,
  Space,
  Spin,
  message,
  Modal,
  Divider,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  SaveOutlined,
  ThunderboltOutlined,
  WalletOutlined,
  FileTextOutlined,
  HomeOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { getBills, createPayment, deleteBill } from '@/api/bills';
import { money, day } from '@/utils/format';
import { statusLabels, toneForBillStatus, billModeText } from './constants';
import { getPaymentAmountError, groupBills, type BillGroup } from './utils';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import type { Bill } from '@/types/domain';
import styles from './MonthlyDetailPage.module.scss';

export default function MonthlyDetailPage() {
  const { currentOrgId } = useAppSession();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [allBills, setAllBills] = useState<Bill[]>([]);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: '线下收款',
    note: '',
  });
  const [paying, setPaying] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const data = await getBills(currentOrgId);
      setAllBills(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const group = useMemo<BillGroup | undefined>(() => {
    if (!id) return undefined;
    const groups = groupBills(allBills);
    return groups.find((g) => g.id === id);
  }, [allBills, id]);

  const remaining = useMemo(
    () => (group ? group.totalAmount - group.paidAmount : 0),
    [group]
  );
  const canPay = useMemo(
    () => group && group.status !== 'PAID' && group.status !== 'VOID',
    [group]
  );

  const handlePayment = async () => {
    if (!currentOrgId || !group) return;
    const error = getPaymentAmountError(paymentForm.amount, remaining);
    if (error) {
      message.error(error);
      return;
    }
    setPaying(true);
    try {
      // 按子账单顺序分摊收款金额
      let unapplied = Number(paymentForm.amount);
      const unpaidBills = group.bills.filter(
        (b) => b.status !== 'PAID' && b.status !== 'VOID'
      );
      for (const bill of unpaidBills) {
        if (unapplied <= 0) break;
        const billRemaining =
          Number(bill.totalAmount) - Number(bill.paidAmount);
        if (billRemaining <= 0) continue;
        const applyAmount = Math.min(unapplied, billRemaining);
        await createPayment(currentOrgId, {
          billId: bill.id,
          amount: applyAmount,
          method: paymentForm.method.trim() || '线下收款',
          note: paymentForm.note.trim() || undefined,
          paidAt: new Date().toISOString(),
        });
        unapplied -= applyAmount;
      }
      message.success('收款已登记');
      setPaymentForm({ amount: '', method: '线下收款', note: '' });
      await loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '收款失败');
    } finally {
      setPaying(false);
    }
  };

  const handleDeleteChild = async (childId: string) => {
    if (!currentOrgId) return;
    Modal.confirm({
      title: '删除账单',
      content: '删除后不可恢复，是否确认？',
      okText: '确认删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteBill(currentOrgId, childId);
          message.success('账单已删除');
          await loadData();
        } catch (e) {
          message.error(e instanceof Error ? e.message : '删除失败');
        }
      },
    });
  };

  if (!group) {
    return (
      <div className="page-content">
        <PageHeader
          back={true}
          breadcrumb={[
            { label: '财务管理', path: '/bills' },
            { label: '月账单详情' },
          ]}
        />
        <EmptyState
          title="账单不存在或已删除"
          description="该账单可能已被删除或您没有访问权限"
        />
      </div>
    );
  }

  return (
    <div className="page-content">
      <PageHeader
        back={true}
        breadcrumb={[
          { label: '财务管理', path: '/bills' },
          { label: '月账单详情' },
        ]}
      />

      <Spin spinning={loading}>
        {/* 账单概览 */}
        <Card className={styles.mdpMb24}>
          <div className="flex-start">
            <div>
              <div className={styles.mdpTitle}>
                <HomeOutlined className={styles.mdpIconPrimary} />
                {group.lease?.room?.roomNo ?? '房间'} · 到期{' '}
                {day(group.dueDate)}
              </div>
              <div className={styles.mdpMeta}>
                应收 ¥{money(group.totalAmount)} · 已收 ¥
                {money(group.paidAmount)}
              </div>
              <div className={styles.mdpPhoneRow}>
                <PhoneOutlined className={styles.mdpIconSmall} />
                租客 {group.tenantName} · {group.lease?.tenantPhone}
              </div>
            </div>
            <Tag color={toneForBillStatus(group.status)}>
              {statusLabels[group.status]}
            </Tag>
          </div>
        </Card>

        {/* 收款登记 */}
        {canPay && (
          <Card
            title={
              <span className={styles.mdpCardTitle}>
                <WalletOutlined />
                登记收款
              </span>
            }
            className={styles.mdpMb24}
          >
            <Space direction="vertical" className="w-full" size="middle">
              <Input
                placeholder="收款金额"
                prefix="¥"
                value={paymentForm.amount}
                onChange={(e) =>
                  setPaymentForm((old) => ({ ...old, amount: e.target.value }))
                }
              />
              <Select
                placeholder="收款方式"
                value={paymentForm.method}
                onChange={(value) =>
                  setPaymentForm((old) => ({ ...old, method: value }))
                }
                className="w-full"
                options={[
                  { label: '线下收款', value: '线下收款' },
                  { label: '现金', value: '现金' },
                  { label: '微信', value: '微信' },
                  { label: '支付宝', value: '支付宝' },
                  { label: '银行转账', value: '银行转账' },
                ]}
              />
              <Input.TextArea
                placeholder="备注（可选）"
                value={paymentForm.note}
                onChange={(e) =>
                  setPaymentForm((old) => ({ ...old, note: e.target.value }))
                }
                rows={2}
              />
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={paying}
                onClick={handlePayment}
              >
                确认收款
              </Button>
            </Space>
          </Card>
        )}

        {/* 子账单明细 */}
        <Card
          title={
            <span className={styles.mdpCardTitle}>
              <FileTextOutlined />
              账单明细
            </span>
          }
          className={styles.mdpMb24}
        >
          {(group.bills ?? []).length === 0 ? (
            <EmptyState
              title="暂无账单明细"
              description="当前账单暂无明细记录"
            />
          ) : (
            <Space direction="vertical" className="w-full">
              {(group.bills ?? []).map((child) => (
                <div key={child.id} className="w-full">
                  <div className="flex-between">
                    <div>
                      <span className={styles.mdpChildTitle}>
                        {billModeText(child.mode)} · {day(child.periodStart)} 至{' '}
                        {day(child.periodEnd)}
                      </span>
                    </div>
                    <Space>
                      <span className={styles.mdpChildAmount}>
                        ¥{money(child.totalAmount)}
                      </span>
                      {child.status !== 'PAID' && (
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => handleDeleteChild(child.id)}
                        >
                          删除
                        </Button>
                      )}
                    </Space>
                  </div>
                  <div className={styles.mdpItemsWrap}>
                    {(child.items ?? []).map((item) => (
                      <div key={item.id} className={styles.mdpItemRow}>
                        <span className="text-muted">
                          {item.name}
                          {item.note ? ` · ${item.note}` : ''}
                        </span>
                        <Space>
                          <span className="text-subtle">
                            ¥{money(item.amount)}
                          </span>
                          {child.status !== 'PAID' && (
                            <Button
                              type="link"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() =>
                                navigate(
                                  `/bills/items/${item.id}/edit?billId=${child.id}&name=${encodeURIComponent(
                                    item.name
                                  )}&amount=${item.amount}&note=${encodeURIComponent(
                                    item.note ?? ''
                                  )}`
                                )
                              }
                            >
                              修改
                            </Button>
                          )}
                        </Space>
                      </div>
                    ))}
                  </div>
                  {child.mode === 'POSTPAID' && child.status !== 'PAID' && (
                    <Button
                      size="small"
                      icon={<ThunderboltOutlined />}
                      onClick={() =>
                        navigate(`/bills/utility?billId=${child.id}`)
                      }
                      className={styles.mdpBtnMt}
                    >
                      录入本期水电
                    </Button>
                  )}
                  <Divider className={styles.mdpDivider} />
                </div>
              ))}
            </Space>
          )}
        </Card>

        {/* 收款记录 */}
        <Card
          title={
            <span className={styles.mdpCardTitle}>
              <WalletOutlined />
              收款记录
            </span>
          }
        >
          {(group.payments ?? []).length === 0 ? (
            <EmptyState title="暂无收款记录" description="当前暂无收款记录" />
          ) : (
            <Space direction="vertical" className="w-full">
              {(group.payments ?? []).map((payment) => (
                <div key={payment.id} className={styles.mdpPaymentRow}>
                  <span className="text-muted">
                    {day(payment.paidAt)} · {payment.method}
                    {payment.note ? ` · ${payment.note}` : ''}
                  </span>
                  <span className={styles.mdpPaymentAmount}>
                    ¥{money(payment.amount)}
                  </span>
                </div>
              ))}
            </Space>
          )}
        </Card>
      </Spin>
    </div>
  );
}
