import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Button,
  Tabs,
  Input,
  Space,
  Empty,
  Tag,
  Spin,
  message,
  Modal,
  Statistic,
  Row,
  Col,
} from "antd";
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  SearchOutlined,
  DownloadOutlined,
  UploadOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useAppSession } from "@/context/AppSessionContext";
import { getMonthlyBills, getBillsByStatus, deleteMonthlyBill, retryBillBilling } from "@/api/bills";
import { getRooms } from "@/api/rooms";
import { money } from "@/utils/format";
import { statusLabels, toneForBillStatus } from "./constants";
import { remainingAmount, sortMonthlyBillsForList, getMonthlyBillCardSummary } from "./utils";
import type { Bill, BillStatus, MonthlyBill } from "@/types/domain";

export default function BillListPage() {
  const { currentOrgId } = useAppSession();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"unpaid" | "pending" | "all">("unpaid");
  const [monthlyBills, setMonthlyBills] = useState<MonthlyBill[]>([]);
  const [reviewBills, setReviewBills] = useState<Bill[]>([]);
  const [, setRooms] = useState<import("@/types/domain").Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BillStatus | "">("");

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const nextMonthlyBills = await getMonthlyBills(currentOrgId);
      const [failedBills, billingBills, nextRooms] = await Promise.all([
        getBillsByStatus(currentOrgId, "FAILED"),
        getBillsByStatus(currentOrgId, "BILLING"),
        getRooms(currentOrgId),
      ]);
      const postpaidReviewBills = [...failedBills, ...billingBills].filter(
        (bill) => bill.mode === "POSTPAID"
      );
      setMonthlyBills(nextMonthlyBills);
      setReviewBills(postpaidReviewBills);
      setRooms(nextRooms);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "账单加载失败");
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const unpaidMonthlyBills = useMemo(
    () => monthlyBills.filter((bill) => bill.status === "UNPAID" || bill.status === "PARTIAL_PAID"),
    [monthlyBills]
  );
  const unpaidTotal = useMemo(
    () => unpaidMonthlyBills.reduce((sum, bill) => sum + remainingAmount(bill), 0),
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
    if (statusFilter) result = result.filter((bill) => bill.status === statusFilter);
    return sortMonthlyBillsForList(result);
  }, [monthlyBills, searchQuery, statusFilter]);

  const handleDelete = async (bill: MonthlyBill) => {
    if (!currentOrgId) return;
    Modal.confirm({
      title: "删除月度账单",
      content: "删除后不可恢复，是否确认？",
      okText: "确认删除",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteMonthlyBill(currentOrgId, bill.id);
          message.success("月度账单已删除");
          await loadData();
        } catch (e) {
          message.error(e instanceof Error ? e.message : "删除失败");
        }
      },
    });
  };

  const handleRetry = async (bill: Bill) => {
    if (!currentOrgId) return;
    try {
      await retryBillBilling(currentOrgId, bill.id);
      message.success("已重新尝试出账");
      await loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "重试失败");
    }
  };

  const renderBillCard = (bill: MonthlyBill, showDelete = false) => {
    const summary = getMonthlyBillCardSummary(bill);
    return (
      <Card
        key={bill.id}
        size="small"
        style={{ marginBottom: 12, cursor: "pointer" }}
        onClick={() => navigate(`/bills/monthly/${bill.id}`)}
        bodyStyle={{ padding: 16 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{summary.title}</div>
            <div style={{ color: "#888", fontSize: 13 }}>{summary.meta}</div>
          </div>
          <Tag color={toneForBillStatus(bill.status)}>{statusLabels[bill.status]}</Tag>
        </div>
        <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#146c5c" }}>
            ¥{money(summary.totalAmount)}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#888", fontSize: 13 }}>剩余 ¥{money(summary.remainingAmount)}</div>
            <div style={{ color: "#888", fontSize: 13 }}>已收 ¥{money(summary.paidAmount)}</div>
          </div>
        </div>
        <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#888", fontSize: 12 }}>{summary.detailCountText}</span>
          <Space>
            {showDelete && bill.status !== "PAID" && (
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
    <Card key={bill.id} size="small" style={{ marginBottom: 12 }} bodyStyle={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>
            {bill.lease?.tenantName ?? "租客"} · {bill.lease?.room?.roomNo ?? "房间"}
          </div>
          <div style={{ color: "#888", fontSize: 13 }}>
            {bill.periodStart?.slice(0, 10)} 至 {bill.periodEnd?.slice(0, 10)}
          </div>
        </div>
        <Tag color={toneForBillStatus(bill.status)}>{statusLabels[bill.status]}</Tag>
      </div>
      <div style={{ marginTop: 8, color: "#ff4d4f" }}>
        {bill.failureReason ?? "需要补录或修正水电读数"}
      </div>
      <div style={{ marginTop: 12 }}>
        <Space>
          <Button size="small" onClick={() => handleRetry(bill)}>重新出账</Button>
          <Button type="primary" size="small" onClick={() => navigate(`/bills/utility?billId=${bill.id}`)}>
            录入本期水电
          </Button>
        </Space>
      </div>
    </Card>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>账单管理</h2>
        <Space>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadData}>
            刷新
          </Button>
        </Space>
      </div>

      <Spin spinning={loading}>
        {/* 统计 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          {tab === "unpaid" && (
            <>
              <Col span={12}>
                <Card>
                  <Statistic title="待支付账单" value={unpaidMonthlyBills.length} />
                </Card>
              </Col>
              <Col span={12}>
                <Card>
                  <Statistic title="待收金额" value={`¥${money(unpaidTotal)}`} />
                </Card>
              </Col>
            </>
          )}
          {tab === "pending" && (
            <Col span={24}>
              <Card>
                <Statistic title="待处理账单" value={reviewBills.length} />
              </Card>
            </Col>
          )}
          {tab === "all" && (
            <>
              <Col span={12}>
                <Card>
                  <Statistic title="全部账单" value={monthlyBills.length} />
                </Card>
              </Col>
              <Col span={12}>
                <Card>
                  <Statistic title="待收金额" value={`¥${money(unpaidTotal)}`} />
                </Card>
              </Col>
            </>
          )}
        </Row>

        {/* 操作栏 */}
        <div style={{ marginBottom: 16 }}>
          <Space>
            {tab === "unpaid" && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/bills/payment")}>
                登记收款
              </Button>
            )}
            {tab === "pending" && (
              <>
                <Button icon={<ThunderboltOutlined />} onClick={() => navigate("/bills/reading")}>
                  录入读数
                </Button>
                <Button icon={<DownloadOutlined />} onClick={() => navigate("/bills/utility-export")}>
                  导出
                </Button>
                <Button icon={<UploadOutlined />} onClick={() => navigate("/bills/utility-import")}>
                  导入
                </Button>
              </>
            )}
          </Space>
        </div>

        <Tabs
          activeKey={tab}
          onChange={(key) => {
            setTab(key as "unpaid" | "pending" | "all");
            setSearchQuery("");
            setStatusFilter("");
          }}
          items={[
            {
              key: "unpaid",
              label: `待支付 (${unpaidMonthlyBills.length})`,
              children: (
                <div>
                  {unpaidMonthlyBills.length === 0 ? (
                    <Empty description="暂无待支付账单" />
                  ) : (
                    sortMonthlyBillsForList(unpaidMonthlyBills).map((bill) => renderBillCard(bill))
                  )}
                </div>
              ),
            },
            {
              key: "pending",
              label: `待处理 (${reviewBills.length})`,
              children: (
                <div>
                  {reviewBills.length === 0 ? (
                    <Empty description="暂无待处理账单" />
                  ) : (
                    reviewBills.map((bill) => renderPendingCard(bill))
                  )}
                </div>
              ),
            },
            {
              key: "all",
              label: `全部 (${monthlyBills.length})`,
              children: (
                <div>
                  <Input
                    placeholder="搜索租客姓名、房间号或手机号"
                    prefix={<SearchOutlined />}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ marginBottom: 12 }}
                    allowClear
                  />
                  <Space wrap style={{ marginBottom: 12 }}>
                    {(["", "UNPAID", "PARTIAL_PAID", "PAID", "FAILED", "VOID"] as const).map(
                      (status) => (
                        <Button
                          key={status || "all"}
                          type={statusFilter === status ? "primary" : "default"}
                          size="small"
                          onClick={() => setStatusFilter(status)}
                        >
                          {status ? statusLabels[status] : "全部状态"}
                        </Button>
                      )
                    )}
                  </Space>
                  {filteredAllBills.length === 0 ? (
                    <Empty description="未找到账单" />
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
