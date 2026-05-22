import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Spin,
  message,
} from "antd";
import {
  SaveOutlined,
  WalletOutlined,
  HomeOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { useAppSession } from "@/context/AppSessionContext";
import { getMonthlyBills, createPayment } from "@/api/bills";
import { getRooms } from "@/api/rooms";
import { money } from "@/utils/format";
import { statusLabels, toneForBillStatus } from "./constants";
import { remainingAmount, roomKeyForBill, sortMonthlyBillsForList, getPaymentAmountError } from "./utils";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import type { MonthlyBill, Room } from "@/types/domain";

export default function PaymentPage() {
  const { currentOrgId } = useAppSession();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [bills, setBills] = useState<MonthlyBill[]>([]);
  const [paymentRoomId, setPaymentRoomId] = useState("");
  const [form, setForm] = useState({ monthlyBillId: "", amount: "", method: "线下收款", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const [nextRooms, nextBills] = await Promise.all([
        getRooms(currentOrgId),
        getMonthlyBills(currentOrgId),
      ]);
      setRooms(nextRooms);
      setBills(nextBills);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentOrgId]);

  const paymentBills = useMemo(
    () => sortMonthlyBillsForList(bills.filter((b) => b.status === "UNPAID" || b.status === "PARTIAL_PAID")),
    [bills]
  );
  const roomBills = useMemo(
    () => paymentBills.filter((bill) => roomKeyForBill(bill) === paymentRoomId),
    [paymentBills, paymentRoomId]
  );

  useEffect(() => {
    if (paymentBills.length > 0 && !paymentRoomId) {
      const first = paymentBills[0];
      if (first) {
        const key = roomKeyForBill(first);
        setPaymentRoomId(key);
        const isPayable = first.status !== "PAID" && first.status !== "VOID";
        setForm({
          monthlyBillId: isPayable ? first.id : "",
          amount: isPayable ? String(remainingAmount(first)) : "",
          method: "线下收款",
          note: "",
        });
      }
    }
  }, [paymentBills, paymentRoomId]);

  const handleRoomClick = (roomId: string) => {
    setPaymentRoomId(roomId);
    const firstBill = paymentBills.find((bill) => roomKeyForBill(bill) === roomId);
    if (firstBill) {
      const isPayable = firstBill.status !== "PAID" && firstBill.status !== "VOID";
      setForm({
        monthlyBillId: isPayable ? firstBill.id : "",
        amount: isPayable ? String(remainingAmount(firstBill)) : "",
        method: "线下收款",
        note: "",
      });
    } else {
      setForm({ monthlyBillId: "", amount: "", method: "线下收款", note: "" });
    }
  };

  const handleBillClick = (bill: MonthlyBill) => {
    const isPayable = bill.status !== "PAID" && bill.status !== "VOID";
    setForm({
      monthlyBillId: isPayable ? bill.id : "",
      amount: isPayable ? String(remainingAmount(bill)) : "",
      method: "线下收款",
      note: "",
    });
  };

  const handleSubmit = async () => {
    if (!currentOrgId || !form.monthlyBillId || !form.amount.trim()) return;
    const bill = bills.find((item) => item.id === form.monthlyBillId);
    if (!bill || bill.status === "PAID" || bill.status === "VOID") return;
    const amountError = getPaymentAmountError(form.amount, remainingAmount(bill));
    if (amountError) {
      message.error(amountError);
      return;
    }
    setSubmitting(true);
    try {
      await createPayment(currentOrgId, {
        monthlyBillId: bill.id,
        amount: Number(form.amount),
        method: form.method.trim() || "线下收款",
        note: form.note.trim() || undefined,
        paidAt: new Date().toISOString(),
      });
      message.success("收款已登记");
      navigate("/bills");
    } catch (e) {
      message.error(e instanceof Error ? e.message : "收款失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-content">
      <PageHeader
        back={true}
        breadcrumb={[
          { label: "财务管理", path: "/bills" },
          { label: "登记收款" },
        ]}
      />

      <Spin spinning={loading}>
        <Card
          title={<span style={{ display: "flex", alignItems: "center", gap: 8 }}><HomeOutlined />选择房间</span>}
          style={{ marginBottom: 24 }}
        >
          {rooms.length === 0 ? (
            <EmptyState description="暂无房间" />
          ) : (
            <Space wrap>
              {rooms.map((room) => (
                <Button
                  key={room.id}
                  type={paymentRoomId === room.id ? "primary" : "default"}
                  onClick={() => handleRoomClick(room.id)}
                >
                  {room.roomNo}
                </Button>
              ))}
            </Space>
          )}
        </Card>

        {paymentRoomId && (
          <Card
            title={<span style={{ display: "flex", alignItems: "center", gap: 8 }}><FileTextOutlined />选择账单</span>}
            style={{ marginBottom: 24 }}
          >
            {roomBills.length === 0 ? (
              <EmptyState description="该房间暂无待收账单" />
            ) : (
              <Space direction="vertical" style={{ width: "100%" }}>
                {roomBills.map((bill) => (
                  <Card
                    key={bill.id}
                    size="small"
                    style={{
                      cursor: "pointer",
                      borderColor: form.monthlyBillId === bill.id ? "var(--th-primary)" : undefined,
                      background: form.monthlyBillId === bill.id ? "rgba(15, 118, 110, 0.04)" : undefined,
                    }}
                    onClick={() => handleBillClick(bill)}
                    bodyStyle={{ padding: "var(--th-space-4)" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--th-foreground)", fontFamily: "var(--th-font-heading)" }}>
                          {bill.billingDate.slice(0, 10)}
                        </div>
                        <div style={{ color: "var(--th-foreground-muted)", fontSize: 13 }}>
                          剩余 ¥{money(remainingAmount(bill))}
                        </div>
                      </div>
                      <Tag color={toneForBillStatus(bill.status)}>{statusLabels[bill.status]}</Tag>
                    </div>
                  </Card>
                ))}
              </Space>
            )}
          </Card>
        )}

        <Card
          title={<span style={{ display: "flex", alignItems: "center", gap: 8 }}><WalletOutlined />收款信息</span>}
        >
          <Space direction="vertical" style={{ width: "100%" }} size="large">
            <Input
              placeholder="收款金额"
              prefix="¥"
              size="large"
              value={form.amount}
              onChange={(e) => setForm((old) => ({ ...old, amount: e.target.value }))}
            />
            <Select
              placeholder="收款方式"
              value={form.method}
              size="large"
              onChange={(value) => setForm((old) => ({ ...old, method: value }))}
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
              value={form.note}
              onChange={(e) => setForm((old) => ({ ...old, note: e.target.value }))}
              rows={3}
            />
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={submitting}
              onClick={handleSubmit}
              disabled={!form.monthlyBillId}
              size="large"
            >
              确认收款
            </Button>
          </Space>
        </Card>
      </Spin>
    </div>
  );
}
