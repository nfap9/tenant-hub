import { useState, useEffect, useRef, useMemo } from "react";
import { Card, Form, InputNumber, Button, message, Spin, Space, Divider } from "antd";
import { useParams, useNavigate } from "react-router-dom";
import { SaveOutlined, ArrowLeftOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { useAppSession, useHasPermission } from "@/context/AppSessionContext";
import { getRooms } from "@/api/rooms";
import { updateLease } from "@/api/leases";
import type { Room } from "@/types/domain";
import { selectableFeeTypes, type LeaseFeeFormItem } from "./constants";
import { buildLeaseFeesPayload } from "./utils";

export default function LeaseEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageLease = useHasPermission("lease:manage");
  const [form] = Form.useForm();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fees, setFees] = useState<LeaseFeeFormItem[]>([]);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!currentOrgId) return;
    setLoading(true);
    getRooms(currentOrgId)
      .then((data) => setRooms(data))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [currentOrgId]);

  const room = useMemo(() => rooms.find((r) => r.id === id), [rooms, id]);
  const lease = useMemo(() => room?.leases?.find((l) => l.status === "ACTIVE"), [room]);

  useEffect(() => {
    if (lease && !initializedRef.current) {
      form.setFieldsValue({
        rentAmount: lease.rentAmount ? Number(lease.rentAmount) : undefined,
        depositAmount: lease.depositAmount ? Number(lease.depositAmount) : undefined,
        waterUnitPrice: Number(lease.waterUnitPrice ?? 0),
        powerUnitPrice: Number(lease.powerUnitPrice ?? 0),
      });
      const leaseFees = lease.fees ?? [];
      setFees(leaseFees.map((fee) => ({
        id: fee.id,
        type: fee.type,
        name: fee.name || selectableFeeTypes.find((f) => f.type === fee.type)?.label || "其他费用",
        amount: String(fee.amount)
      })));
      initializedRef.current = true;
    }
  }, [lease, form]);

  const addFee = () => {
    const availableTypes = selectableFeeTypes.filter((item) => !fees.some((fee) => fee.type === item.type));
    if (availableTypes.length === 0) {
      message.warning("费用项目已全部添加");
      return;
    }
    const selected = availableTypes[0];
    setFees((old) => [...old, { id: `${selected.type}-${Date.now()}`, type: selected.type, name: selected.label, amount: "" }]);
  };

  const updateFeeAmount = (feeId: string, amount: string) => {
    setFees((old) => old.map((item) => (item.id === feeId ? { ...item, amount } : item)));
  };

  const removeFee = (feeId: string) => {
    setFees((old) => old.filter((item) => item.id !== feeId));
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!currentOrgId || !lease) return;
    if (!canManageLease) { message.warning("当前角色没有管理租约权限"); return; }

    setSaving(true);
    try {
      await updateLease(currentOrgId, lease.id, {
        rentAmount: values.rentAmount !== undefined && values.rentAmount !== "" ? Number(values.rentAmount) : undefined,
        depositAmount: values.depositAmount !== undefined && values.depositAmount !== "" ? Number(values.depositAmount) : undefined,
        waterUnitPrice: Number(values.waterUnitPrice || 0),
        powerUnitPrice: Number(values.powerUnitPrice || 0),
        fees: buildLeaseFeesPayload(fees),
      });
      message.success("租约信息已更新");
      navigate("/rooms");
    } catch (e) {
      message.error(e instanceof Error ? e.message : "更新租约失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/rooms")}>返回</Button>
        <h2 style={{ margin: 0 }}>编辑租约</h2>
      </div>
      <Spin spinning={loading}>
        <Card style={{ maxWidth: 720 }}>
          {lease ? (
            <Form form={form} layout="vertical" onFinish={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Form.Item label="租金" name="rentAmount">
                  <InputNumber min={0} style={{ width: "100%" }} prefix="¥" placeholder="每期金额" />
                </Form.Item>
                <Form.Item label="押金" name="depositAmount">
                  <InputNumber min={0} style={{ width: "100%" }} prefix="¥" placeholder="请输入押金" />
                </Form.Item>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Form.Item label="水费单价（元/吨）" name="waterUnitPrice">
                  <InputNumber min={0} style={{ width: "100%" }} />
                </Form.Item>
                <Form.Item label="电费单价（元/度）" name="powerUnitPrice">
                  <InputNumber min={0} style={{ width: "100%" }} />
                </Form.Item>
              </div>

              <Divider orientation="left">费用项目</Divider>
              {fees.map((item) => (
                <Space key={item.id} style={{ display: "flex", marginBottom: 8 }} align="baseline">
                  <span style={{ width: 80, display: "inline-block" }}>{item.name}</span>
                  <InputNumber
                    min={0}
                    placeholder="价格"
                    value={item.amount ? Number(item.amount) : undefined}
                    onChange={(v) => updateFeeAmount(item.id, String(v || 0))}
                  />
                  <Button type="link" danger icon={<DeleteOutlined />} onClick={() => removeFee(item.id)} />
                </Space>
              ))}
              <div style={{ marginBottom: 16 }}>
                <Button type="dashed" icon={<PlusOutlined />} onClick={addFee}>添加费用</Button>
              </div>

              <Form.Item>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} disabled={saving}>
                  保存修改
                </Button>
                <Button style={{ marginLeft: 8 }} onClick={() => navigate("/rooms")}>取消</Button>
              </Form.Item>
            </Form>
          ) : (
            <div style={{ color: "#888", textAlign: "center", padding: 40 }}>租约不存在或已结束</div>
          )}
        </Card>
      </Spin>
    </div>
  );
}
