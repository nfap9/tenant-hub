import { useState } from "react";
import { Card, Form, Input, InputNumber, DatePicker, Button, message } from "antd";
import { useParams, useNavigate } from "react-router-dom";
import { SaveOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useAppSession, useHasPermission } from "@/context/AppSessionContext";
import { createApartmentExpense } from "@/api/apartments";
import { optionalText } from "@/utils/format";

export default function ApartmentExpensePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageApartment = useHasPermission("apartment:manage");
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!currentOrgId || !id) return;
    if (!canManageApartment) { message.warning("当前角色没有管理公寓权限"); return; }
    if (!values.name || !values.amount) { message.warning("请填写花费名称和金额"); return; }

    setSaving(true);
    try {
      await createApartmentExpense(currentOrgId, id, {
        name: String(values.name).trim(),
        amount: Number(values.amount),
        spentAt: dayjs(values.spentAt as string).format("YYYY-MM-DD"),
        note: optionalText(values.note),
      });
      message.success("经营花费已记录");
      navigate(`/apartments/${id}`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "记录花费失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/apartments/${id}`)}>返回</Button>
        <h2 style={{ margin: 0 }}>记录花费</h2>
      </div>
      <Card style={{ maxWidth: 600 }}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="花费名称" name="name" rules={[{ required: true, message: "请输入花费名称" }]}>
            <Input placeholder="例如 维修材料" />
          </Form.Item>
          <Form.Item label="金额" name="amount" rules={[{ required: true, message: "请输入金额" }]}>
            <InputNumber min={0} style={{ width: "100%" }} prefix="¥" />
          </Form.Item>
          <Form.Item label="日期" name="spentAt" rules={[{ required: true, message: "请选择日期" }]} initialValue={dayjs()}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="备注" name="note">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} disabled={saving}>
              保存花费
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={() => navigate(`/apartments/${id}`)}>取消</Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
