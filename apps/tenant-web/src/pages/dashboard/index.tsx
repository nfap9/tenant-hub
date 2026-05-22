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
  ApartmentOutlined,
  HomeOutlined,
  FileTextOutlined,
  WalletOutlined,
  ReloadOutlined,
  RightOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  EditOutlined,
  PlusOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { useAppSession } from '@/context/AppSessionContext';
import { getApartments } from '@/api/apartments';
import { getRooms } from '@/api/rooms';
import { getMonthlyBills, getBillsByStatus } from '@/api/bills';
import {
  compactMoney,
  isThisMonth,
  daysUntil,
  monthlyAmount,
} from '@/utils/format';
import type { Apartment, Room, Lease, MonthlyBill, Bill } from '@/types/domain';
import Overview from './Overview';

const leaseMonthlyIncome = (lease: Lease) => {
  const rent = monthlyAmount(lease.rentAmount, lease.cycle);
  const fees = (lease.fees ?? []).reduce(
    (sum, fee) => sum + monthlyAmount(fee.amount, lease.cycle),
    0
  );
  return rent + fees;
};

const isUnpaid = (bill: MonthlyBill) =>
  bill.status !== 'PAID' && bill.status !== 'VOID';
const isOverdue = (bill: MonthlyBill) =>
  isUnpaid(bill) &&
  bill.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10);

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
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [monthlyBills, setMonthlyBills] = useState<MonthlyBill[]>([]);
  const [reviewBills, setReviewBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const [
        nextApartments,
        nextRooms,
        nextMonthlyBills,
        failedBills,
        billingBills,
      ] = await Promise.all([
        getApartments(currentOrgId),
        getRooms(currentOrgId),
        getMonthlyBills(currentOrgId),
        getBillsByStatus(currentOrgId, 'FAILED'),
        getBillsByStatus(currentOrgId, 'BILLING'),
      ]);
      setApartments(nextApartments);
      setRooms(nextRooms);
      setMonthlyBills(nextMonthlyBills);
      setReviewBills(
        [...failedBills, ...billingBills].filter(
          (bill) => bill.mode === 'POSTPAID'
        )
      );
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
  const unpaidTotal = monthlyBills
    .filter(isUnpaid)
    .reduce(
      (sum, bill) => sum + Number(bill.totalAmount) - Number(bill.paidAmount),
      0
    );
  const paidThisMonth = monthlyBills
    .filter((bill) => isThisMonth(bill.billingDate))
    .reduce((sum, bill) => sum + Number(bill.paidAmount ?? 0), 0);
  const overdueBills = monthlyBills.filter(isOverdue);
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
              (sum, bill) =>
                sum + Number(bill.totalAmount) - Number(bill.paidAmount),
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
          onClick: () => navigate('/settings/leases'),
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
    <div className="page-content">
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
              onClick={() => navigate('/bills/payment')}
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

        {/* 统计卡片 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="公寓总数"
              value={apartments.length}
              icon={<ApartmentOutlined />}
              color="primary"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="房间总数"
              value={rooms.length}
              icon={<HomeOutlined />}
              color="accent"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="在租租约"
              value={activeLeases.length}
              icon={<TeamOutlined />}
              color="success"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="待收账单"
              value={monthlyBills.filter(isUnpaid).length}
              icon={<FileTextOutlined />}
              color="warning"
            />
          </Col>
        </Row>

        {/* 出租率 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={12}>
            <Card
              title={
                <span
                  style={{ fontWeight: 600, color: 'var(--th-foreground)' }}
                >
                  出租情况
                </span>
              }
              style={{
                borderRadius: 'var(--th-radius-lg)',
                boxShadow: 'var(--th-shadow)',
              }}
            >
              <Row gutter={16}>
                <Col span={12} style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 700,
                      color: 'var(--th-success)',
                    }}
                  >
                    {vacantCount}
                  </div>
                  <div style={{ color: 'var(--th-foreground-muted)' }}>
                    空闲房间
                  </div>
                </Col>
                <Col span={12} style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 700,
                      color: 'var(--th-primary)',
                    }}
                  >
                    {occupiedCount}
                  </div>
                  <div style={{ color: 'var(--th-foreground-muted)' }}>
                    已租房间
                  </div>
                </Col>
              </Row>
              <div style={{ marginTop: 20 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      color: 'var(--th-foreground-muted)',
                      fontSize: 13,
                    }}
                  >
                    出租率
                  </span>
                  <span
                    style={{
                      color: 'var(--th-primary)',
                      fontWeight: 700,
                      fontSize: 16,
                    }}
                  >
                    {occupancyRate}%
                  </span>
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
                <div style={{ marginTop: 16 }}>
                  <div
                    style={{
                      marginBottom: 8,
                      color: 'var(--th-foreground-muted)',
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    空闲户型
                  </div>
                  <Space wrap>
                    {vacantLayoutStats.map(([layout, count]) => (
                      <Tag
                        key={layout}
                        color="default"
                        style={{ borderRadius: 8 }}
                      >
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
                <span
                  style={{ fontWeight: 600, color: 'var(--th-foreground)' }}
                >
                  待办事项 {todos.length > 0 ? `(${todos.length} 项)` : ''}
                </span>
              }
              style={{
                borderRadius: 'var(--th-radius-lg)',
                boxShadow: 'var(--th-shadow)',
              }}
            >
              {todos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <CheckCircleOutlined
                    style={{
                      fontSize: 48,
                      color: 'var(--th-success)',
                      marginBottom: 16,
                    }}
                  />
                  <div
                    style={{
                      fontWeight: 600,
                      color: 'var(--th-foreground)',
                      marginBottom: 4,
                    }}
                  >
                    暂无紧急待办
                  </div>
                  <div style={{ color: 'var(--th-foreground-muted)' }}>
                    经营状态稳定
                  </div>
                </div>
              ) : (
                <Space
                  direction="vertical"
                  style={{ width: '100%' }}
                  size="middle"
                >
                  {todos.map((todo) => {
                    const tone = todoToneMap[todo.tone] ?? todoToneMap.green;
                    return (
                      <Card
                        key={todo.key}
                        size="small"
                        style={{
                          cursor: 'pointer',
                          width: '100%',
                          borderRadius: 'var(--th-radius-lg)',
                          borderLeft: `4px solid ${tone.color}`,
                          transition:
                            'transform 0.2s ease, box-shadow 0.2s ease',
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
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 12,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                background: tone.bg,
                                color: tone.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 16,
                                flexShrink: 0,
                              }}
                            >
                              {tone.icon}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontWeight: 600,
                                  color: 'var(--th-foreground)',
                                  marginBottom: 2,
                                }}
                              >
                                {todo.title}
                              </div>
                              <div
                                style={{
                                  color: 'var(--th-foreground-muted)',
                                  fontSize: 13,
                                }}
                              >
                                {todo.detail}
                              </div>
                            </div>
                          </div>
                          <Space style={{ flexShrink: 0 }}>
                            <Tag
                              color={todo.tone}
                              style={{ borderRadius: 8, fontWeight: 500 }}
                            >
                              {todo.badge}
                            </Tag>
                            <RightOutlined
                              style={{ color: 'var(--th-foreground-muted)' }}
                            />
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
      </Spin>
    </div>
  );
}
