import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Tabs,
  Input,
  Space,
  Tag,
  Spin,
  message,
  Modal,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  SearchOutlined,
  DownloadOutlined,
  UploadOutlined,
  ThunderboltOutlined,
  ExclamationCircleOutlined,
  ThunderboltFilled,
  StopOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import { useAppSession, useHasPermission } from '@/context/AppSessionContext';
import {
  getBills,
  getBillsByStatus,
  deleteBill,
  voidBill,
  refundBill,
  retryBillBilling,
  generateBills,
} from '@/api/bills';
import { getRooms } from '@/api/rooms';
import { money } from '@/utils/format';
import { statusLabels, toneForBillStatus } from './constants';
import {
  groupBills,
  sortBillGroupsForList,
  getBillGroupCardSummary,
  type BillGroup,
} from './utils';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import PaymentDialog from '@/components/PaymentDialog';
import UtilityExportModal from './UtilityExportModal';
import UtilityModal from './UtilityModal';
import ReadingDrawer from './ReadingDrawer';
import type { Bill, BillStatus } from '@/types/domain';
import styles from './BillListPage.module.scss';
import clsx from 'clsx';

export default function BillListPage() {
  const { currentOrgId } = useAppSession();
  const canManageBill = useHasPermission('bill:manage');
  const navigate = useNavigate();
  const [tab, setTab] = useState<'unpaid' | 'pending' | 'all'>('unpaid');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [utilityExportOpen, setUtilityExportOpen] = useState(false);
  const [utilityOpen, setUtilityOpen] = useState(false);
  const [utilityBillId, setUtilityBillId] = useState<string | null>(null);
  const [readingOpen, setReadingOpen] = useState(false);
  const [billGroups, setBillGroups] = useState<BillGroup[]>([]);
  const [reviewBills, setReviewBills] = useState<Bill[]>([]);
  const [, setRooms] = useState<import('@/types/domain').Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BillStatus | ''>('');

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const [allBills, failedBills, billingBills, nextRooms] =
        await Promise.all([
          getBills(currentOrgId),
          getBillsByStatus(currentOrgId, 'FAILED'),
          getBillsByStatus(currentOrgId, 'BILLING'),
          getRooms(currentOrgId),
        ]);
      const postpaidReviewBills = [...failedBills, ...billingBills].filter(
        (bill) => bill.mode === 'POSTPAID'
      );
      setBillGroups(groupBills(allBills));
      setReviewBills(postpaidReviewBills);
      setRooms(nextRooms);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '账单加载失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const unpaidGroups = useMemo(
    () =>
      billGroups.filter(
        (g) => g.status === 'UNPAID' || g.status === 'PARTIAL_PAID'
      ),
    [billGroups]
  );
  const filteredAllGroups = useMemo(() => {
    let result = [...billGroups];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (g) =>
          g.tenantName?.toLowerCase().includes(q) ||
          g.lease?.room?.roomNo?.toLowerCase().includes(q) ||
          g.tenantPhone?.includes(q)
      );
    }
    if (statusFilter) result = result.filter((g) => g.status === statusFilter);
    return sortBillGroupsForList(result);
  }, [billGroups, searchQuery, statusFilter]);

  const handleDeleteGroup = async (group: BillGroup) => {
    if (!currentOrgId) return;
    Modal.confirm({
      title: '删除账单组',
      content: `将删除该组 ${group.bills.length} 笔账单，删除后不可恢复，是否确认？`,
      okText: '确认删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await Promise.all(
            group.bills.map((b) => deleteBill(currentOrgId, b.id))
          );
          message.success('账单组已删除');
          await loadData();
        } catch (e) {
          message.error(e instanceof Error ? e.message : '删除失败');
        }
      },
    });
  };

  const handleRetry = async (bill: Bill) => {
    if (!currentOrgId) return;
    try {
      await retryBillBilling(currentOrgId, bill.id);
      message.success('已重新尝试出账');
      await loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '重试失败');
    }
  };

  const handleVoidGroup = async (group: BillGroup) => {
    if (!currentOrgId) return;
    try {
      await Promise.all(group.bills.map((b) => voidBill(currentOrgId, b.id)));
      message.success('账单组已作废');
      await loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '作废失败');
    }
  };

  const handleRefundGroup = async (group: BillGroup) => {
    if (!currentOrgId) return;
    const netPaid = Number(group.paidAmount) || 0;
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
      await Promise.all(
        group.bills
          .filter((b) => b.status === 'PAID')
          .map((b) =>
            refundBill(currentOrgId, b.id, {
              amount,
              method: methodParts.join(' ') || '退款',
            })
          )
      );
      message.success('退款已登记');
      await loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '退款失败');
    }
  };

  const renderBillCard = (group: BillGroup, showDelete = false) => {
    const summary = getBillGroupCardSummary(group);
    return (
      <Card
        key={group.id}
        size="small"
        className={clsx(styles.billCard, 'cursor-pointer')}
        onClick={() => navigate(`/bills/monthly/${group.id}`)}
        bodyStyle={{ padding: 'var(--th-space-5)' }}
      >
        <div className="flex-start">
          <div>
            <div className={styles.billCardTitle}>{summary.title}</div>
            <div className={styles.billCardMeta}>{summary.meta}</div>
          </div>
          <Tag color={toneForBillStatus(group.status)}>
            {statusLabels[group.status]}
          </Tag>
        </div>
        <div className={styles.billCardFooter}>
          <div
            className={clsx(
              styles.billCardAmount,
              group.status === 'REFUNDED' && styles.billCardAmountRefund
            )}
          >
            ¥{money(summary.totalAmount)}
          </div>
          <div className={styles.textRight}>
            <div className={styles.billCardMuted}>
              剩余 ¥{money(summary.remainingAmount)}
            </div>
            <div className={styles.billCardSubtle}>
              已收 ¥{money(summary.paidAmount)}
            </div>
          </div>
        </div>
        <div className={styles.billCardActions}>
          <span className={styles.billCardCount}>
            {summary.detailCountText}
          </span>
          <Space>
            {showDelete &&
              group.status !== 'PAID' &&
              group.status !== 'VOID' &&
              group.status !== 'REFUNDED' && (
                <>
                  {canManageBill && (
                    <Popconfirm
                      title="作废账单组"
                      description="作废后所有账单将无法继续收款或恢复，确认作废？"
                      onConfirm={(e) => {
                        e?.stopPropagation();
                        handleVoidGroup(group);
                      }}
                      okText="确认作废"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                      onPopupClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        type="text"
                        size="small"
                        icon={<StopOutlined />}
                        onClick={(e) => e.stopPropagation()}
                      >
                        作废
                      </Button>
                    </Popconfirm>
                  )}
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteGroup(group);
                    }}
                  >
                    删除
                  </Button>
                </>
              )}
            {showDelete && group.status === 'PAID' && canManageBill && (
              <Button
                type="text"
                size="small"
                icon={<RollbackOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRefundGroup(group);
                }}
              >
                退款
              </Button>
            )}
            <Button type="link" size="small" icon={<EyeOutlined />}>
              查看详情
            </Button>
          </Space>
        </div>
      </Card>
    );
  };

  const renderPendingCard = (bill: Bill) => (
    <Card
      key={bill.id}
      size="small"
      className={styles.billCard}
      bodyStyle={{ padding: 'var(--th-space-5)' }}
    >
      <div className="flex-start">
        <div>
          <div className={styles.billCardTitle}>
            {bill.lease?.tenantName ?? '租客'} ·{' '}
            {bill.lease?.room?.roomNo ?? '房间'}
          </div>
          <div className={styles.billCardMeta}>
            {bill.periodStart?.slice(0, 10)} 至 {bill.periodEnd?.slice(0, 10)}
          </div>
        </div>
        <Tag color={toneForBillStatus(bill.status)}>
          {statusLabels[bill.status]}
        </Tag>
      </div>
      <div className={styles.billCardAlert}>
        <ExclamationCircleOutlined className={styles.billListAlertIcon} />
        {bill.failureReason ?? '需要补录或修正水电读数'}
      </div>
      <div className={styles.pendingActions}>
        <Space>
          <Button size="small" onClick={() => handleRetry(bill)}>
            重新出账
          </Button>
          <Button
            type="primary"
            size="small"
            onClick={() => {
              setUtilityBillId(bill.id);
              setUtilityOpen(true);
            }}
          >
            录入本期水电
          </Button>
        </Space>
      </div>
    </Card>
  );

  return (
    <div className="page-content">
      <PageHeader
        breadcrumb={[
          { label: '财务管理', path: '/bills' },
          { label: '账单管理' },
        ]}
        actions={
          <Space>
            {tab === 'unpaid' && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setPaymentOpen(true)}
              >
                登记收款
              </Button>
            )}
            {tab === 'pending' && (
              <>
                <Button
                  icon={<ThunderboltOutlined />}
                  onClick={() => setReadingOpen(true)}
                >
                  录入读数
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => setUtilityExportOpen(true)}
                >
                  导出
                </Button>
                <Button
                  icon={<UploadOutlined />}
                  onClick={() => navigate('/bills/utility-import')}
                >
                  导入
                </Button>
              </>
            )}
            <Button
              icon={<ThunderboltFilled />}
              onClick={async () => {
                if (!currentOrgId) return;
                Modal.confirm({
                  title: '手动生成账单',
                  content:
                    '将为所有有效租约生成到当前日期为止的账单，是否继续？',
                  okText: '确认生成',
                  onOk: async () => {
                    try {
                      const result = await generateBills(currentOrgId);
                      message.success(`已生成 ${result.billIds.length} 笔账单`);
                      await loadData();
                    } catch (e) {
                      message.error(
                        e instanceof Error ? e.message : '生成失败'
                      );
                    }
                  },
                });
              }}
            >
              生成账单
            </Button>
            <Button
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={loadData}
            >
              刷新
            </Button>
          </Space>
        }
      />

      <Spin spinning={loading}>
        <Tabs
          activeKey={tab}
          onChange={(key) => {
            setTab(key as 'unpaid' | 'pending' | 'all');
            setSearchQuery('');
            setStatusFilter('');
          }}
          items={[
            {
              key: 'unpaid',
              label: `待支付 (${unpaidGroups.length})`,
              children: (
                <div>
                  {unpaidGroups.length === 0 ? (
                    <EmptyState
                      title="暂无待支付账单"
                      description="当前没有待支付的账单记录"
                    />
                  ) : (
                    sortBillGroupsForList(unpaidGroups).map((g) =>
                      renderBillCard(g)
                    )
                  )}
                </div>
              ),
            },
            {
              key: 'pending',
              label: `待处理 (${reviewBills.length})`,
              children: (
                <div>
                  {reviewBills.length === 0 ? (
                    <EmptyState
                      title="暂无待处理账单"
                      description="所有账单均已处理完毕"
                    />
                  ) : (
                    reviewBills.map((bill) => renderPendingCard(bill))
                  )}
                </div>
              ),
            },
            {
              key: 'all',
              label: `全部 (${billGroups.length})`,
              children: (
                <div>
                  <Input
                    placeholder="搜索租客姓名、房间号或手机号"
                    prefix={<SearchOutlined />}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="mb-16"
                    allowClear
                  />
                  <Space wrap className="mb-16">
                    {(
                      [
                        '',
                        'UNPAID',
                        'PARTIAL_PAID',
                        'PAID',
                        'FAILED',
                        'VOID',
                        'REFUNDED',
                      ] as const
                    ).map((status) => (
                      <Button
                        key={status || 'all'}
                        type={statusFilter === status ? 'primary' : 'default'}
                        size="small"
                        onClick={() => setStatusFilter(status)}
                      >
                        {status ? statusLabels[status] : '全部状态'}
                      </Button>
                    ))}
                  </Space>
                  {filteredAllGroups.length === 0 ? (
                    <EmptyState
                      title="未找到账单"
                      description="请尝试调整搜索条件或筛选状态"
                    />
                  ) : (
                    filteredAllGroups.map((g) => renderBillCard(g, true))
                  )}
                </div>
              ),
            },
          ]}
        />
      </Spin>

      <PaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onSuccess={loadData}
      />

      <UtilityExportModal
        open={utilityExportOpen}
        onClose={() => setUtilityExportOpen(false)}
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

      <ReadingDrawer
        open={readingOpen}
        onClose={() => setReadingOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
}
