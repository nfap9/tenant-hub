// PAGE-501: 运营总览 Dashboard
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Progress,
  Button,
  Tag,
  Space,
  Spin,
  message,
} from 'antd';
import {
  FileTextOutlined,
  WalletOutlined,
  ReloadOutlined,
  RightOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  EditOutlined,
  PlusOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import PageHeader from '@/components/ui/PageHeader';
import PaymentDialog from '@/components/PaymentDialog';
import { useAppSession } from '@/context/AppSessionContext';
import { getAllApartments } from '@/api/apartments';
import { getRooms } from '@/api/rooms';
import { getBills, getBillsByStatus } from '@/api/bills';
import { getOccupancyTrend, getIncomeExpenseTrend } from '@/api/reports';
import {
  compactMoney,
  isThisMonth,
  daysUntil,
  monthlyAmount,
} from '@/utils/format';
import type { Apartment, Room, Lease, Bill } from '@/types/domain';
import Overview from './OverviewCard';
import DashboardCharts from './DashboardCharts';
import styles from './index.module.scss';
import clsx from 'clsx';

const leaseMonthlyIncome = (lease: Lease) => {
  const rent = monthlyAmount(lease.rentAmount, lease.cycle);
  const fees = (lease.fees ?? []).reduce(
    (sum, fee) => sum + monthlyAmount(fee.amount, lease.cycle),
    0
  );
  return rent + fees;
};

import { groupBills, type BillGroup } from '@/pages/bills/utils';

const isUnpaid = (group: BillGroup) =>
  group.status !== 'PAID' && group.status !== 'VOID';
const isOverdue = (group: BillGroup) =>
  isUnpaid(group) &&
  group.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10);

const todoToneMap: Record<
  string,
  { color: string; bg: string; icon: React.ReactNode }
> = {
  red: {
    color: 'var(--th-danger)',
    bg: 'rgba(220, 38, 38, 0.08)',
    icon: <ExclamationCircleOutlined />,
  },
  orange: {
    color: '#EA580C',
    bg: 'rgba(234, 88, 12, 0.08)',
    icon: <EditOutlined />,
  },
  green: {
    color: 'var(--th-success)',
    bg: 'rgba(34, 197, 94, 0.08)',
    icon: <PlusOutlined />,
  },
};

export default function DashboardPage() {
  const { currentOrgId } = useAppSession();
  const navigate = useNavigate();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [billGroups, setBillGroups] = useState<BillGroup[]>([]);
  const [reviewBills, setReviewBills] = useState<Bill[]>([]);
  const [occupancyTrend, setOccupancyTrend] = useState<
    { month: string; occupancyRate: number }[]
  >([]);
  const [incomeExpenseTrend, setIncomeExpenseTrend] = useState<
    { month: string; income: number; expense: number }[]
  >([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const [
        nextApartments,
        nextRooms,
        allBills,
        failedBills,
        billingBills,
        occupancyTrendData,
        incomeExpenseTrendData,
      ] = await Promise.all([
        getAllApartments(currentOrgId),
        getRooms(currentOrgId),
        getBills(currentOrgId),
        getBillsByStatus(currentOrgId, 'FAILED'),
        getBillsByStatus(currentOrgId, 'BILLING'),
        getOccupancyTrend(currentOrgId).catch(() => ({ months: [] })),
        getIncomeExpenseTrend(currentOrgId).catch(() => ({ months: [] })),
      ]);
      setApartments(nextApartments);
      setRooms(nextRooms);
      setBillGroups(groupBills(allBills.filter((b) => b.type !== 'DEPOSIT')));
      setReviewBills(
        [...failedBills, ...billingBills].filter(
          (bill) => bill.mode === 'POSTPAID'
        )
      );
      setOccupancyTrend(occupancyTrendData.months);
      setIncomeExpenseTrend(incomeExpenseTrendData.months);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '首页数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeLeases = useMemo(
    () =>
      rooms
        .flatMap((room) => room.leases ?? [])
        .filter((lease) => lease.status === 'ACTIVE'),
    [rooms]
  );
  const occupiedCount = rooms.filter(
    (room) => room.status === 'OCCUPIED'
  ).length;
  const vacantCount = rooms.filter((room) => room.status === 'VACANT').length;
  const occupancyRate = rooms.length
    ? Math.round((occupiedCount / rooms.length) * 100)
    : 0;

  const vacantLayoutStats = useMemo(() => {
    const layoutCounts = rooms
      .filter((room) => room.status === 'VACANT')
      .reduce<Record<string, number>>((counts, room) => {
        const layout = room.layout.trim() || '未配置';
        counts[layout] = (counts[layout] ?? 0) + 1;
        return counts;
      }, {});
    return Object.entries(layoutCounts).sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
    );
  }, [rooms]);

  const monthlyIncome = activeLeases.reduce(
    (sum, lease) => sum + leaseMonthlyIncome(lease),
    0
  );
  const thisMonthExpense = apartments
    .flatMap((apartment) => apartment.expenses ?? [])
    .filter((expense) => isThisMonth(expense.spentAt))
    .reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const unpaidTotal = billGroups
    .filter(isUnpaid)
    .reduce((sum, group) => sum + group.totalAmount - group.paidAmount, 0);
  const paidThisMonth = billGroups
    .filter((group) => isThisMonth(group.billingDate))
    .reduce((sum, group) => sum + group.paidAmount, 0);
  const overdueBills = billGroups.filter(isOverdue);
  const expiringLeases = activeLeases
    .map((lease) => ({ lease, remainingDays: daysUntil(lease.endDate) }))
    .filter((item) => item.remainingDays >= 0 && item.remainingDays <= 30)
    .sort((left, right) => left.remainingDays - right.remainingDays);

  const todos = [
    overdueBills.length
      ? {
          key: 'overdue',
          title: '逾期账单',
          detail: `${overdueBills.length} 张账单已过应收日，剩余待收 ¥${compactMoney(
            overdueBills.reduce(
              (sum, group) => sum + group.totalAmount - group.paidAmount,
              0
            )
          )}`,
          badge: '收款',
          tone: 'red' as const,
          onClick: () => navigate('/bills'),
        }
      : undefined,
    reviewBills.length
      ? {
          key: 'review',
          title: '后付费出账处理',
          detail: `${reviewBills.length} 张水电账单需要补读数或重新出账`,
          badge: '出账',
          tone: 'orange' as const,
          onClick: () => navigate('/bills'),
        }
      : undefined,
    expiringLeases.length
      ? {
          key: 'lease',
          title: '租约即将到期',
          detail: `${expiringLeases[0].lease.tenantName} ${expiringLeases[0].remainingDays} 天后到期，共 ${expiringLeases.length} 份需跟进`,
          badge: '续租',
          tone: 'orange' as const,
          onClick: () => navigate('/leases'),
        }
      : undefined,
    vacantCount
      ? {
          key: 'vacant',
          title: '空房可出租',
          detail: `${vacantCount} 间空房可继续签约，当前出租率 ${occupancyRate}%`,
          badge: '招租',
          tone: 'green' as const,
          onClick: () => navigate('/rooms'),
        }
      : undefined,
  ].filter(Boolean) as {
    key: string;
    title: string;
    detail: string;
    badge: string;
    tone: string;
    onClick: () => void;
  }[];

  return (
    <div className={clsx(styles.dashboardPage, 'page-content')}>
      <PageHeader
        breadcrumb={[{ label: '首页' }]}
        actions={
          <>
            <Button
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={loadData}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<WalletOutlined />}
              onClick={() => setPaymentOpen(true)}
            >
              登记收款
            </Button>
            <Button
              icon={<FileTextOutlined />}
              onClick={() => navigate('/rooms')}
            >
              签约入住
            </Button>
            <Button
              icon={<ThunderboltOutlined />}
              onClick={() => navigate('/bills/reading')}
            >
              抄表录入
            </Button>
          </>
        }
      />

      <Spin spinning={loading}>
        {/* 经营概览 */}
        <Overview
          monthlyIncome={monthlyIncome}
          paidThisMonth={paidThisMonth}
          unpaidTotal={unpaidTotal}
          thisMonthExpense={thisMonthExpense}
        ></Overview>

        {/* 出租率 */}
        <Row gutter={[16, 16]} className={styles.statGrid}>
          <Col xs={24} lg={12}>
            <Card
              title={
                <span className={styles.dashboardCardTitle}>出租情况</span>
              }
            >
              <Row gutter={16}>
                <Col span={12} className="text-center">
                  <div className={styles.statValueSuccess}>{vacantCount}</div>
                  <div className="text-muted">空闲房间</div>
                </Col>
                <Col span={12} className="text-center">
                  <div className={styles.statValuePrimary}>{occupiedCount}</div>
                  <div className="text-muted">已租房间</div>
                </Col>
              </Row>
              <div className="mt-20">
                <div className={styles.progressHeader}>
                  <span className={styles.progressLabel}>出租率</span>
                  <span className={styles.progressValue}>{occupancyRate}%</span>
                </div>
                <Progress
                  percent={occupancyRate}
                  strokeColor="var(--th-primary)"
                  trailColor="var(--th-border)"
                  strokeWidth={12}
                  showInfo={false}
                />
              </div>
              {vacantLayoutStats.length > 0 && (
                <div className={styles.vacantLayouts}>
                  <div className={styles.vacantLayoutsLabel}>空闲户型</div>
                  <Space wrap>
                    {vacantLayoutStats.map(([layout, count]) => (
                      <Tag key={layout} color="default">
                        {layout} {count}间
                      </Tag>
                    ))}
                  </Space>
                </div>
              )}
            </Card>
          </Col>

          {/* 待办事项 */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <span className={styles.dashboardCardTitle}>
                  待办事项 {todos.length > 0 ? `(${todos.length} 项)` : ''}
                </span>
              }
            >
              {todos.length === 0 ? (
                <div className={styles.todoEmpty}>
                  <CheckCircleOutlined className={styles.todoEmptyIcon} />
                  <div className={styles.todoEmptyTitle}>暂无紧急待办</div>
                  <div className={styles.todoEmptyDesc}>经营状态稳定</div>
                </div>
              ) : (
                <Space direction="vertical" className="w-full" size="middle">
                  {todos.map((todo) => {
                    const tone = todoToneMap[todo.tone] ?? todoToneMap.green;
                    return (
                      <Card
                        key={todo.key}
                        size="small"
                        className={styles.todoCard}
                        style={{
                          borderLeft: `4px solid ${tone.color}`,
                        }}
                        bodyStyle={{ padding: 16 }}
                        onClick={todo.onClick}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.transform =
                            'translateY(-2px)';
                          (e.currentTarget as HTMLElement).style.boxShadow =
                            '0 4px 12px rgba(0,0,0,0.08)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.transform =
                            'translateY(0)';
                          (e.currentTarget as HTMLElement).style.boxShadow =
                            'none';
                        }}
                      >
                        <div className={styles.todoItem}>
                          <div className={styles.todoMain}>
                            <div
                              className={styles.todoIcon}
                              style={{
                                background: tone.bg,
                                color: tone.color,
                              }}
                            >
                              {tone.icon}
                            </div>
                            <div className={styles.todoText}>
                              <div className={styles.todoTitle}>
                                {todo.title}
                              </div>
                              <div className={styles.todoDetail}>
                                {todo.detail}
                              </div>
                            </div>
                          </div>
                          <Space className={styles.todoMeta}>
                            <Tag color={todo.tone}>{todo.badge}</Tag>
                            <RightOutlined className="text-muted" />
                          </Space>
                        </div>
                      </Card>
                    );
                  })}
                </Space>
              )}
            </Card>
          </Col>
        </Row>

        {/* 图表 */}
        <DashboardCharts
          occupancyTrend={occupancyTrend}
          incomeExpenseTrend={incomeExpenseTrend}
          rooms={rooms}
        />
      </Spin>

      <PaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
}
