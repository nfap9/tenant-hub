import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Tag,
  Empty,
  Space,
  Spin,
  message,
} from "antd";
import {
  ApartmentOutlined,
  HomeOutlined,
  FileTextOutlined,
  WalletOutlined,
  ReloadOutlined,
  RightOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { useAppSession } from "@/context/AppSessionContext";
import { getApartments } from "@/api/apartments";
import { getRooms } from "@/api/rooms";
import { getMonthlyBills, getBillsByStatus } from "@/api/bills";
import { compactMoney, isThisMonth, daysUntil, monthlyAmount } from "@/utils/format";
import type { Apartment, Room, Lease, MonthlyBill, Bill } from "@/types/domain";

const leaseMonthlyIncome = (lease: Lease) => {
  const rent = monthlyAmount(lease.rentAmount, lease.cycle);
  const fees = (lease.fees ?? []).reduce(
    (sum, fee) => sum + monthlyAmount(fee.amount, lease.cycle),
    0
  );
  return rent + fees;
};

const isUnpaid = (bill: MonthlyBill) => bill.status !== "PAID" && bill.status !== "VOID";
const isOverdue = (bill: MonthlyBill) =>
  isUnpaid(bill) && bill.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10);

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
      const [nextApartments, nextRooms, nextMonthlyBills, failedBills, billingBills] =
        await Promise.all([
          getApartments(currentOrgId),
          getRooms(currentOrgId),
          getMonthlyBills(currentOrgId),
          getBillsByStatus(currentOrgId, "FAILED"),
          getBillsByStatus(currentOrgId, "BILLING"),
        ]);
      setApartments(nextApartments);
      setRooms(nextRooms);
      setMonthlyBills(nextMonthlyBills);
      setReviewBills(
        [...failedBills, ...billingBills].filter((bill) => bill.mode === "POSTPAID")
      );
    } catch (e) {
      message.error(e instanceof Error ? e.message : "首页数据加载失败");
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
        .filter((lease) => lease.status === "ACTIVE"),
    [rooms]
  );
  const occupiedCount = rooms.filter((room) => room.status === "OCCUPIED").length;
  const vacantCount = rooms.filter((room) => room.status === "VACANT").length;
  const occupancyRate = rooms.length ? Math.round((occupiedCount / rooms.length) * 100) : 0;

  const vacantLayoutStats = useMemo(() => {
    const layoutCounts = rooms
      .filter((room) => room.status === "VACANT")
      .reduce<Record<string, number>>((counts, room) => {
        const layout = room.layout.trim() || "未配置";
        counts[layout] = (counts[layout] ?? 0) + 1;
        return counts;
      }, {});
    return Object.entries(layoutCounts).sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
    );
  }, [rooms]);

  const monthlyIncome = activeLeases.reduce((sum, lease) => sum + leaseMonthlyIncome(lease), 0);
  const thisMonthExpense = apartments
    .flatMap((apartment) => apartment.expenses ?? [])
    .filter((expense) => isThisMonth(expense.spentAt))
    .reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const unpaidTotal = monthlyBills
    .filter(isUnpaid)
    .reduce((sum, bill) => sum + Number(bill.totalAmount) - Number(bill.paidAmount), 0);
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
          key: "overdue",
          title: "逾期账单",
          detail: `${overdueBills.length} 张账单已过应收日，剩余待收 ¥${compactMoney(
            overdueBills.reduce(
              (sum, bill) => sum + Number(bill.totalAmount) - Number(bill.paidAmount),
              0
            )
          )}`,
          badge: "收款",
          tone: "red" as const,
          onClick: () => navigate("/bills"),
        }
      : undefined,
    reviewBills.length
      ? {
          key: "review",
          title: "后付费出账处理",
          detail: `${reviewBills.length} 张水电账单需要补读数或重新出账`,
          badge: "出账",
          tone: "orange" as const,
          onClick: () => navigate("/bills"),
        }
      : undefined,
    expiringLeases.length
      ? {
          key: "lease",
          title: "租约即将到期",
          detail: `${expiringLeases[0].lease.tenantName} ${expiringLeases[0].remainingDays} 天后到期，共 ${expiringLeases.length} 份需跟进`,
          badge: "续租",
          tone: "orange" as const,
          onClick: () => navigate("/settings/leases"),
        }
      : undefined,
    vacantCount
      ? {
          key: "vacant",
          title: "空房可出租",
          detail: `${vacantCount} 间空房可继续签约，当前出租率 ${occupancyRate}%`,
          badge: "招租",
          tone: "green" as const,
          onClick: () => navigate("/rooms"),
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
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>首页</h2>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={loadData}>
          刷新
        </Button>
      </div>

      <Spin spinning={loading}>
        {/* 经营概览 */}
        <Card style={{ marginBottom: 16, background: "#146c5c", color: "#fff" }}>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, marginBottom: 4 }}>
            本月经营概览
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 16, color: "#fff" }}>
            ¥{compactMoney(monthlyIncome)}
          </div>
          <Row gutter={16}>
            <Col span={8}>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>已收</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#fff" }}>
                ¥{compactMoney(paidThisMonth)}
              </div>
            </Col>
            <Col span={8}>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>待收</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#fff" }}>
                ¥{compactMoney(unpaidTotal)}
              </div>
            </Col>
            <Col span={8}>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>支出</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#fff" }}>
                ¥{compactMoney(thisMonthExpense)}
              </div>
            </Col>
          </Row>
        </Card>

        {/* 统计卡片 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="公寓总数"
                value={apartments.length}
                prefix={<ApartmentOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="房间总数"
                value={rooms.length}
                prefix={<HomeOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="待收账单"
                value={monthlyBills.filter(isUnpaid).length}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="本月收入"
                value={compactMoney(paidThisMonth)}
                prefix={<WalletOutlined />}
                suffix="元"
              />
            </Card>
          </Col>
        </Row>

        {/* 出租率 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={12}>
            <Card title="出租情况">
              <Row gutter={16}>
                <Col span={12} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: "#52c41a" }}>
                    {vacantCount}
                  </div>
                  <div style={{ color: "#888" }}>空闲房间</div>
                </Col>
                <Col span={12} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: "#146c5c" }}>
                    {occupiedCount}
                  </div>
                  <div style={{ color: "#888" }}>已租房间</div>
                </Col>
              </Row>
              <div style={{ marginTop: 16 }}>
                <span style={{ color: "#888" }}>出租率 {occupancyRate}%</span>
              </div>
              {vacantLayoutStats.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ marginBottom: 8, color: "#666" }}>空闲户型</div>
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
            <Card title={`待办事项 ${todos.length > 0 ? `(${todos.length} 项)` : ""}`}>
              {todos.length === 0 ? (
                <Empty
                  image={<CheckCircleOutlined style={{ fontSize: 48, color: "#52c41a" }} />}
                  description={
                    <div>
                      <div style={{ fontWeight: 600 }}>暂无紧急待办</div>
                      <div style={{ color: "#888" }}>经营状态稳定</div>
                    </div>
                  }
                />
              ) : (
                <Space direction="vertical" style={{ width: "100%" }}>
                  {todos.map((todo) => (
                    <Card
                      key={todo.key}
                      size="small"
                      style={{ cursor: "pointer", width: "100%" }}
                      onClick={todo.onClick}
                      bodyStyle={{ padding: 12 }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{todo.title}</div>
                          <div style={{ color: "#888", fontSize: 13 }}>{todo.detail}</div>
                        </div>
                        <Space>
                          <Tag color={todo.tone}>{todo.badge}</Tag>
                          <RightOutlined style={{ color: "#bbb" }} />
                        </Space>
                      </div>
                    </Card>
                  ))}
                </Space>
              )}
            </Card>
          </Col>
        </Row>

        {/* 快捷操作 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24}>
            <Card title="快捷操作">
              <Space size="middle">
                <Button
                  type="primary"
                  icon={<WalletOutlined />}
                  onClick={() => navigate("/bills/payment")}
                >
                  登记收款
                </Button>
                <Button
                  icon={<FileTextOutlined />}
                  onClick={() => navigate("/rooms")}
                >
                  签约入住
                </Button>
                <Button
                  icon={<ThunderboltOutlined />}
                  onClick={() => navigate("/bills/reading")}
                >
                  抄表录入
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}
