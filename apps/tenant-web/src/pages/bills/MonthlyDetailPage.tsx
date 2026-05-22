import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  SaveOutlined,
  ThunderboltOutlined,
  WalletOutlined,
  FileTextOutlined,

  HomeOutlined,
  PhoneOutlined,
} from "@ant-design/icons";
import { useAppSession } from "@/context/AppSessionContext";
import { getMonthlyBills, createPayment, deleteBill } from "@/api/bills";
import { money, day } from "@/utils/format";
import { statusLabels, toneForBillStatus, billModeText } from "./constants";
import { getPaymentAmountError } from "./utils";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import type { MonthlyBill } from "@/types/domain";

export default function MonthlyDetailPage() {
  const { currentOrgId } = useAppSession();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [monthlyBills, setMonthlyBills] = useState<MonthlyBill[]>([]);
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "线下收款", note: "" });
  const [paying, setPaying] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const data = await getMonthlyBills(currentOrgId);
      setMonthlyBills(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const bill = useMemo(
    () => monthlyBills.find((b) => b.id === id),
    [monthlyBills, id]
  );
  const remaining = useMemo(
    () => (bill ? Number(bill.totalAmount) - Number(bill.paidAmount) : 0),
    [bill]
  );
  const canPay = useMemo(
    () => bill && bill.status !== "PAID" && bill.status !== "VOID",
    [bill]
  );

  const handlePayment = async () => {
    if (!currentOrgId || !bill) return;
    const error = getPaymentAmountError(paymentForm.amount, remaining);
    if (error) {
      message.error(error);
      return;
    }
    setPaying(true);
    try {
      await createPayment(currentOrgId, {
        monthlyBillId: bill.id,
        amount: Number(paymentForm.amount),
        method: paymentForm.method.trim() || "线下收款",
        note: paymentForm.note.trim() || undefined,
        paidAt: new Date().toISOString(),
      });
      message.success("收款已登记");
      setPaymentForm({ amount: "", method: "线下收款", note: "" });
      await loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "收款失败");
    } finally {
      setPaying(false);
    }
  };

  const handleDeleteChild = async (childId: string) => {
    if (!currentOrgId) return;
    Modal.confirm({
      title: "删除账单",
      content: "删除后不可恢复，是否确认？",
      okText: "确认删除",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteBill(currentOrgId, childId);
          message.success("账单已删除");
          await loadData();
        } catch (e) {
          message.error(e instanceof Error ? e.message : "删除失败");
        }
      },
    });
  };

  if (!bill) {
    return (
      <div className="page-content">
        <PageHeader
          back={true}
          breadcrumb={[
            { label: "财务管理", path: "/bills" },
            { label: "月账单详情" },
          ]}
        />
        <EmptyState title="账单不存在或已删除" description="该账单可能已被删除或您没有访问权限" />
      </div>
    );
  }

  return (
    <div className="page-content">
      <PageHeader
        back={true}
        breadcrumb={[
          { label: "财务管理", path: "/bills" },
          { label: "月账单详情" },
        ]}
      />

      <Spin spinning={loading}>
        {/* 账单概览 */}
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16, fontFamily: "var(--th-font-heading)", color: "var(--th-foreground)" }}>
                <HomeOutlined style={{ marginRight: 6, color: "var(--th-primary)" }} />
                {bill.lease?.room?.roomNo ?? "房间"} · 到期 {day(bill.dueDate)}
              </div>
              <div style={{ color: "var(--th-foreground-muted)", marginTop: 6 }}>
                应收 ¥{money(bill.totalAmount)} · 已收 ¥{money(bill.paidAmount)}
              </div>
              <div style={{ color: "var(--th-foreground-muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <PhoneOutlined style={{ fontSize: 12 }} />
                租客 {bill.tenantName} · {bill.lease?.tenantPhone}
              </div>
            </div>
            <Tag color={toneForBillStatus(bill.status)}>{statusLabels[bill.status]}</Tag>
          </div>
        </Card>

        {/* 收款登记 */}
        {canPay && (
          <Card
            title={<span style={{ display: "flex", alignItems: "center", gap: 8 }}><WalletOutlined />登记收款</span>}
            style={{ marginBottom: 24 }}
          >
            <Space direction="vertical" style={{ width: "100%" }} size="middle">
              <Input
                placeholder="收款金额"
                prefix="¥"
                size="large"
                value={paymentForm.amount}
                onChange={(e) =>
                  setPaymentForm((old) => ({ ...old, amount: e.target.value }))
                }
              />
              <Select
                placeholder="收款方式"
                value={paymentForm.method}
                size="large"
                onChange={(value) =>
                  setPaymentForm((old) => ({ ...old, method: value }))
                }
                style={{ width: "100%" }}
                options={[
                  { label: "线下收款", value: "线下收款" },
                  { label: "现金", value: "现金" },
                  { label: "微信", value: "微信" },
                  { label: "支付宝", value: "支付宝" },
                  { label: "银行转账", value: "银行转账" },
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
                size="large"
              >
                确认收款
              </Button>
            </Space>
          </Card>
        )}

        {/* 子账单明细 */}
        <Card
          title={<span style={{ display: "flex", alignItems: "center", gap: 8 }}><FileTextOutlined />账单明细</span>}
          style={{ marginBottom: 24 }}
        >
          {(bill.bills ?? []).length === 0 ? (
            <EmptyState title="暂无账单明细" description="当前账单暂无明细记录" />
          ) : (
            <Space direction="vertical" style={{ width: "100%" }}>
              {(bill.bills ?? []).map((child) => (
                <div key={child.id} style={{ width: "100%" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, color: "var(--th-foreground)", fontFamily: "var(--th-font-heading)" }}>
                        {billModeText(child.mode)} · {day(child.periodStart)} 至{" "}
                        {day(child.periodEnd)}
                      </span>
                    </div>
                    <Space>
                      <span style={{ fontWeight: 600, color: "var(--th-primary)", fontFamily: "var(--th-font-heading)" }}>
                        ¥{money(child.totalAmount)}
                      </span>
                      {child.status !== "PAID" && (
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
                  <div style={{ marginTop: 8, paddingLeft: 16 }}>
                    {(child.items ?? []).map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "6px 0",
                          borderBottom: "1px solid var(--th-border-light)",
                        }}
                      >
                        <span style={{ color: "var(--th-foreground-muted)" }}>
                          {item.name}
                          {item.note ? ` · ${item.note}` : ""}
                        </span>
                        <Space>
                          <span style={{ color: "var(--th-foreground-subtle)" }}>¥{money(item.amount)}</span>
                          {child.status !== "PAID" && (
                            <Button
                              type="link"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() =>
                                navigate(
                                  `/bills/items/${item.id}/edit?billId=${child.id}&name=${encodeURIComponent(
                                    item.name
                                  )}&amount=${item.amount}&note=${encodeURIComponent(
                                    item.note ?? ""
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
                  {child.mode === "POSTPAID" && child.status !== "PAID" && (
                    <Button
                      size="small"
                      icon={<ThunderboltOutlined />}
                      onClick={() => navigate(`/bills/utility?billId=${child.id}`)}
                      style={{ marginTop: 8 }}
                    >
                      录入本期水电
                    </Button>
                  )}
                  <Divider style={{ margin: "16px 0" }} />
                </div>
              ))}
            </Space>
          )}
        </Card>

        {/* 收款记录 */}
        <Card
          title={<span style={{ display: "flex", alignItems: "center", gap: 8 }}><WalletOutlined />收款记录</span>}
        >
          {(bill.payments ?? []).length === 0 ? (
            <EmptyState title="暂无收款记录" description="当前暂无收款记录" />
          ) : (
            <Space direction="vertical" style={{ width: "100%" }}>
              {(bill.payments ?? []).map((payment) => (
                <div
                  key={payment.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: "1px solid var(--th-border-light)",
                  }}
                >
                  <span style={{ color: "var(--th-foreground-muted)" }}>
                    {day(payment.paidAt)} · {payment.method}
                    {payment.note ? ` · ${payment.note}` : ""}
                  </span>
                  <span style={{ fontWeight: 600, color: "var(--th-primary)", fontFamily: "var(--th-font-heading)" }}>
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
