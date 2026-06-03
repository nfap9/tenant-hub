import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Button,
  Tag,
  Space,
  Spin,
  message,
  Modal,
  Divider,
  Row,
  Col,
  Popconfirm,
} from 'antd';
import {
  DeleteOutlined,
  ThunderboltOutlined,
  WalletOutlined,
  FileTextOutlined,
  HomeOutlined,
  StopOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import { getBills, deleteBill, voidBill, refundBill } from '@/api/bills';
import { money, day } from '@/utils/format';
import { statusLabels, toneForBillStatus, billModeText } from './constants';
import { groupBills, type BillGroup } from './utils';
import type { Bill } from '@/types/domain';
import PageHeader from '@/components/ui/PageHeader';
import PaymentDialog from '@/components/PaymentDialog';
import UtilityModal from './UtilityModal';
import EmptyState from '@/components/ui/EmptyState';
import DetailSection from '@/components/ui/DetailSection';
import DetailItem from '@/components/ui/DetailItem';
import styles from './MonthlyDetailPage.module.scss';
import clsx from 'clsx';

export default function MonthlyDetailPage() {
  const { currentOrgId } = useAppSession();
  const canManageBill = useHasPermission('bill:manage');
  const { id } = useParams<{ id: string }>();
  const [allBills, setAllBills] = useState<Bill[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [utilityOpen, setUtilityOpen] = useState(false);
  const [utilityBillId, setUtilityBillId] = useState<string | null>(null);
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

  const handleVoid = async (billGroup: BillGroup) => {
    if (!currentOrgId) return;
    try {
      for (const bill of billGroup.bills) {
        await voidBill(currentOrgId, bill.id);
      }
      message.success('账单已作废');
      loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '作废账单失败');
    }
  };

  const handleRefund = async (billGroup: BillGroup) => {
    if (!currentOrgId) return;
    const netPaid = Number(billGroup.paidAmount) || 0;
    const method = window.prompt(
      `退款金额（已付 ¥${netPaid.toFixed(2)}）/ 退款方式：`,
      `${netPaid.toFixed(2)} 现金`
    );
    if (!method) return;
    const [amountStr, ...methodParts] = method.split(' ');
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      message.warning('请输入有效退款金额');
      return;
    }
    try {
      for (const bill of billGroup.bills) {
        if (bill.status === 'PAID') {
          await refundBill(currentOrgId, bill.id, {
            amount,
            method: methodParts.join(' ') || '退款',
          });
        }
      }
      message.success('退款已登记');
      loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '登记退款失败');
    }
  };

  const group = useMemo<BillGroup | undefined>(() => {
    if (!id) return undefined;
    const groups = groupBills(allBills);
    return groups.find((g) => g.id === id);
  }, [allBills, id]);

  const canPay = useMemo(
    () =>
      group &&
      group.status !== 'PAID' &&
      group.status !== 'VOID' &&
      group.status !== 'REFUNDED',
    [group]
  );

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
            { label: '账单详情' },
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
          { label: '账单详情' },
        ]}
        actions={
          canPay || (canManageBill && group) ? (
            <Space>
              {canPay && (
                <Button
                  type="primary"
                  icon={<WalletOutlined />}
                  onClick={() => setPaymentOpen(true)}
                >
                  登记收款
                </Button>
              )}
              {canManageBill &&
                group.status !== 'PAID' &&
                group.status !== 'VOID' &&
                group.status !== 'REFUNDED' && (
                  <Popconfirm
                    title="作废账单"
                    description="作废后账单将无法继续收款或恢复，确认作废？"
                    onConfirm={() => handleVoid(group)}
                    okText="确认作废"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                  >
                    <Button danger icon={<StopOutlined />}>
                      作废
                    </Button>
                  </Popconfirm>
                )}
              {canManageBill && group.status === 'PAID' && (
                <Button
                  icon={<RollbackOutlined />}
                  onClick={() => handleRefund(group)}
                >
                  退款
                </Button>
              )}
            </Space>
          ) : undefined
        }
      />

      <Spin spinning={loading}>
        {/* 账单概览 */}
        <DetailSection
          title={
            <span className={styles.mdpTitle}>
              <HomeOutlined className={styles.mdpIconPrimary} />
              {group.lease?.room?.roomNo ?? '房间'} · 到期 {day(group.dueDate)}
            </span>
          }
          actions={
            <Tag color={toneForBillStatus(group.status)}>
              {statusLabels[group.status]}
            </Tag>
          }
        >
          <Row gutter={[24, 0]}>
            <Col span={8}>
              <DetailItem label="租客">{group.tenantName}</DetailItem>
            </Col>
            <Col span={8}>
              <DetailItem label="租客电话">
                {group.lease?.tenantPhone || '-'}
              </DetailItem>
            </Col>
            <Col span={8}>
              <DetailItem
                label={
                  group.bills.some((b) => b.status === 'REFUNDED')
                    ? '应退金额'
                    : '应收金额'
                }
              >
                <span
                  style={{
                    color: group.bills.some((b) => b.status === 'REFUNDED')
                      ? 'var(--th-danger)'
                      : undefined,
                    fontWeight: 600,
                  }}
                >
                  ¥{money(group.totalAmount)}
                </span>
              </DetailItem>
            </Col>
            <Col span={8}>
              <DetailItem label="已收金额">
                ¥{money(group.paidAmount)}
              </DetailItem>
            </Col>
          </Row>
        </DetailSection>

        <Divider />

        {/* 账单明细 */}
        <div className={styles.mdpSection}>
          <div className={styles.mdpSectionTitle}>
            <FileTextOutlined />
            账单明细
          </div>
          {(group.bills ?? []).length === 0 ? (
            <EmptyState
              title="暂无账单明细"
              description="当前账单暂无明细记录"
            />
          ) : (
            <Space direction="vertical" className="w-full">
              {(group.bills ?? []).map((child, index) => (
                <div key={child.id} className="w-full">
                  <div className="flex-between">
                    <div>
                      <span className={styles.mdpChildTitle}>
                        {billModeText(child.mode)} · {day(child.periodStart)} 至{' '}
                        {day(child.periodEnd)}
                      </span>
                    </div>
                    <Space>
                      <span
                        className={clsx(
                          styles.mdpChildAmount,
                          child.status === 'REFUNDED' &&
                            styles.mdpChildAmountRefund
                        )}
                      >
                        ¥{money(child.totalAmount)}
                      </span>
                      {child.status !== 'PAID' &&
                        child.status !== 'VOID' &&
                        child.status !== 'REFUNDED' && (
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
                          <span
                            className={clsx(
                              'text-subtle',
                              item.name.includes('退款') &&
                                styles.mdpItemAmountRefund
                            )}
                          >
                            ¥{money(item.amount)}
                          </span>
                        </Space>
                      </div>
                    ))}
                  </div>
                  {child.mode === 'POSTPAID' &&
                    child.status !== 'PAID' &&
                    child.status !== 'VOID' &&
                    child.status !== 'REFUNDED' && (
                      <Button
                        size="small"
                        icon={<ThunderboltOutlined />}
                        onClick={() => {
                          setUtilityBillId(child.id);
                          setUtilityOpen(true);
                        }}
                        className={styles.mdpBtnMt}
                      >
                        录入本期水电
                      </Button>
                    )}
                  {index < (group.bills ?? []).length - 1 && (
                    <Divider className={styles.mdpDivider} />
                  )}
                </div>
              ))}
            </Space>
          )}
        </div>

        <Divider />

        {/* 收款记录 */}
        <div className={styles.mdpSection}>
          <div className={styles.mdpSectionTitle}>
            <WalletOutlined />
            收款记录
          </div>
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
        </div>
      </Spin>

      <PaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onSuccess={loadData}
        defaultLeaseId={group?.lease?.id}
      />

      <UtilityModal
        open={utilityOpen}
        billId={utilityBillId}
        onClose={() => {
          setUtilityBillId(null);
          setUtilityOpen(false);
        }}
        onSuccess={loadData}
      />
    </div>
  );
}
