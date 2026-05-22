import { Card, Form, Input, InputNumber, DatePicker, Select, Switch, Button, message } from "antd";
import { useParams, useNavigate } from "react-router-dom";
import { SaveOutlined } from "@ant-design/icons";

export default function LeaseFormPage() {
  useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const handleSubmit = async (values: unknown) => {
    console.log(values);
    message.success("创建成功");
    navigate("/rooms");
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>新增租约</h2>
      <Card>
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ maxWidth: 600 }}>
          <Form.Item label="租客姓名" name="tenantName" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="租客电话" name="tenantPhone" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="起租日期" name="startDate" rules={[{ required: true }]}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="到期日期" name="endDate" rules={[{ required: true }]}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="租金" name="rentAmount" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: "100%" }} prefix="¥" />
          </Form.Item>
          <Form.Item label="押金" name="depositAmount" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: "100%" }} prefix="¥" />
          </Form.Item>
          <Form.Item label="付款周期" name="cycle" rules={[{ required: true }]} initialValue="MONTHLY">
            <Select
              options={[
                { label: "月付", value: "MONTHLY" },
                { label: "季付", value: "QUARTERLY" },
                { label: "年付", value: "YEARLY" },
              ]}
            />
          </Form.Item>
          <Form.Item label="自动续约" name="autoRenew" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
              保存
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
