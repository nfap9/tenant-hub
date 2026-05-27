import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  ThunderboltOutlined,
  WalletOutlined,
  FileTextOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { getBills, deleteBill } from '@/api/bills';
import { money, day } from '@/utils/format';
import { statusLabels, toneForBillStatus, billModeText } from './constants';
import { groupBills, type BillGroup } from './utils';
import type { Bill } from '@/types/domain';
import PageHeader from '@/components/ui/PageHeader';
import PaymentDialog from '@/components/PaymentDialog';
import EmptyState from '@/components/ui/EmptyState';
import DetailSection from '@/components/ui/DetailSection';
import DetailItem from '@/components/ui/DetailItem';
import styles from './MonthlyDetailPage.module.scss';

export default function MonthlyDetailPage() {
  const { currentOrgId } = useAppSession();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [allBills, setAllBills] = useState<Bill[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
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

  const canPay = useMemo(
    () => group && group.status !== 'PAID' && group.status !== 'VOID',
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
          canPay ? (
            <Button
              type="primary"
              icon={<WalletOutlined />}
              onClick={() => setPaymentOpen(true)}
            >
              登记收款
            </Button>
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
              <DetailItem label="应收金额">
                ¥{money(group.totalAmount)}
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
    </div>
  );
}
