import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useAppSession } from "@/context/AppSessionContext";
import { updateBillItem } from "@/api/bills";

export default function EditItemPage() {
  const { currentOrgId } = useAppSession();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const billId = searchParams.get("billId");
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    form.setFieldsValue({
      name: searchParams.get("name") || "",
      amount: Number(searchParams.get("amount") || 0),
      note: searchParams.get("note") || "",
    });
  }, [searchParams, form]);

  const handleSubmit = async (values: { name: string; amount: number; note?: string }) => {
    if (!currentOrgId || !billId || !id) return;
    setSubmitting(true);
    try {
      await updateBillItem(currentOrgId, billId, id, {
        amount: values.amount,
        note: values.note,
      });
      message.success("保存成功");
      navigate(-1);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>编辑账单项目</h2>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          返回
        </Button>
      </div>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ maxWidth: 600 }}
        >
          <Form.Item label="名称" name="name">
            <Input disabled />
          </Form.Item>
          <Form.Item
            label="金额"
            name="amount"
            rules={[{ required: true, message: "请输入金额" }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} prefix="¥" />
          </Form.Item>
          <Form.Item label="备注" name="note">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={submitting}>
              保存
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
