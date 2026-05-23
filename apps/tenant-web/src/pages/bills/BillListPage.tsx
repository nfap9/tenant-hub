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
  Row,
  Col,
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
  WalletOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import {
  getMonthlyBills,
  getBillsByStatus,
  deleteMonthlyBill,
  retryBillBilling,
} from '@/api/bills';
import { getRooms } from '@/api/rooms';
import { money } from '@/utils/format';
import { statusLabels, toneForBillStatus } from './constants';
import {
  remainingAmount,
  sortMonthlyBillsForList,
  getMonthlyBillCardSummary,
} from './utils';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import type { Bill, BillStatus, MonthlyBill } from '@/types/domain';
import styles from './BillListPage.module.scss';
import clsx from 'clsx';

export default function BillListPage() {
  const { currentOrgId } = useAppSession();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'unpaid' | 'pending' | 'all'>('unpaid');
  const [monthlyBills, setMonthlyBills] = useState<MonthlyBill[]>([]);
  const [reviewBills, setReviewBills] = useState<Bill[]>([]);
  const [, setRooms] = useState<import('@/types/domain').Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BillStatus | ''>('');

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const nextMonthlyBills = await getMonthlyBills(currentOrgId);
      const [failedBills, billingBills, nextRooms] = await Promise.all([
        getBillsByStatus(currentOrgId, 'FAILED'),
        getBillsByStatus(currentOrgId, 'BILLING'),
        getRooms(currentOrgId),
      ]);
      const postpaidReviewBills = [...failedBills, ...billingBills].filter(
        (bill) => bill.mode === 'POSTPAID'
      );
      setMonthlyBills(nextMonthlyBills);
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

  const unpaidMonthlyBills = useMemo(
    () =>
      monthlyBills.filter(
        (bill) => bill.status === 'UNPAID' || bill.status === 'PARTIAL_PAID'
      ),
    [monthlyBills]
  );
  const unpaidTotal = useMemo(
    () =>
      unpaidMonthlyBills.reduce((sum, bill) => sum + remainingAmount(bill), 0),
    [unpaidMonthlyBills]
  );

  const filteredAllBills = useMemo(() => {
    let result = [...monthlyBills];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (bill) =>
          bill.tenantName?.toLowerCase().includes(q) ||
          bill.lease?.room?.roomNo?.toLowerCase().includes(q) ||
          bill.lease?.tenantPhone?.includes(q)
      );
    }
    if (statusFilter)
      result = result.filter((bill) => bill.status === statusFilter);
    return sortMonthlyBillsForList(result);
  }, [monthlyBills, searchQuery, statusFilter]);

  const handleDelete = async (bill: MonthlyBill) => {
    if (!currentOrgId) return;
    Modal.confirm({
      title: '删除月度账单',
      content: '删除后不可恢复，是否确认？',
      okText: '确认删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteMonthlyBill(currentOrgId, bill.id);
          message.success('月度账单已删除');
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

  const renderBillCard = (bill: MonthlyBill, showDelete = false) => {
    const summary = getMonthlyBillCardSummary(bill);
    return (
      <Card
        key={bill.id}
        size="small"
        className={clsx(styles.billCard, 'cursor-pointer')}
        onClick={() => navigate(`/bills/monthly/${bill.id}`)}
        bodyStyle={{ padding: 'var(--th-space-5)' }}
      >
        <div className="flex-start">
          <div>
            <div className={styles.billCardTitle}>{summary.title}</div>
            <div className={styles.billCardMeta}>{summary.meta}</div>
          </div>
          <Tag color={toneForBillStatus(bill.status)}>
            {statusLabels[bill.status]}
          </Tag>
        </div>
        <div className={styles.billCardFooter}>
          <div className={styles.billCardAmount}>
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
            {showDelete && bill.status !== 'PAID' && (
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(bill);
                }}
              >
                删除
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
            onClick={() => navigate(`/bills/utility?billId=${bill.id}`)}
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
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={loadData}
          >
            刷新
          </Button>
        }
      />

      <Spin spinning={loading}>
        {/* 统计 */}
        <Row gutter={[16, 16]} className={styles.statsRow}>
          {tab === 'unpaid' && (
            <>
              <Col xs={24} sm={12}>
                <StatCard
                  title="待支付账单"
                  value={unpaidMonthlyBills.length}
                  icon={<FileTextOutlined />}
                  color="warning"
                />
              </Col>
              <Col xs={24} sm={12}>
                <StatCard
                  title="待收金额"
                  value={`¥${money(unpaidTotal)}`}
                  icon={<WalletOutlined />}
                  color="danger"
                />
              </Col>
            </>
          )}
          {tab === 'pending' && (
            <Col span={24}>
              <StatCard
                title="待处理账单"
                value={reviewBills.length}
                icon={<ExclamationCircleOutlined />}
                color="warning"
              />
            </Col>
          )}
          {tab === 'all' && (
            <>
              <Col xs={24} sm={12}>
                <StatCard
                  title="全部账单"
                  value={monthlyBills.length}
                  icon={<FileTextOutlined />}
                  color="primary"
                />
              </Col>
              <Col xs={24} sm={12}>
                <StatCard
                  title="待收金额"
                  value={`¥${money(unpaidTotal)}`}
                  icon={<WalletOutlined />}
                  color="danger"
                />
              </Col>
            </>
          )}
        </Row>

        {/* 操作栏 */}
        <div className="mb-16">
          <Space>
            {tab === 'unpaid' && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/bills/payment')}
              >
                登记收款
              </Button>
            )}
            {tab === 'pending' && (
              <>
                <Button
                  icon={<ThunderboltOutlined />}
                  onClick={() => navigate('/bills/reading')}
                >
                  录入读数
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => navigate('/bills/utility-export')}
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
          </Space>
        </div>

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
              label: `待支付 (${unpaidMonthlyBills.length})`,
              children: (
                <div>
                  {unpaidMonthlyBills.length === 0 ? (
                    <EmptyState
                      title="暂无待支付账单"
                      description="当前没有待支付的账单记录"
                    />
                  ) : (
                    sortMonthlyBillsForList(unpaidMonthlyBills).map((bill) =>
                      renderBillCard(bill)
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
              label: `全部 (${monthlyBills.length})`,
              children: (
                <div>
                  <Input
                    placeholder="搜索租客姓名、房间号或手机号"
                    prefix={<SearchOutlined />}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="mb-16"
                    allowClear
                    size="large"
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
                  {filteredAllBills.length === 0 ? (
                    <EmptyState
                      title="未找到账单"
                      description="请尝试调整搜索条件或筛选状态"
                    />
                  ) : (
                    filteredAllBills.map((bill) => renderBillCard(bill, true))
                  )}
                </div>
              ),
            },
          ]}
        />
      </Spin>
    </div>
  );
}
