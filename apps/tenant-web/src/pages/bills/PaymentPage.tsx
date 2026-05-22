import { Card, Form, Input, InputNumber, DatePicker, Select, Button, message } from "antd";
import { SaveOutlined } from "@ant-design/icons";

export default function PaymentPage() {
  const [form] = Form.useForm();

  const handleSubmit = async (values: unknown) => {
    console.log(values);
    message.success("收款录入成功");
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>收款录入</h2>
      <Card>
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ maxWidth: 600 }}>
          <Form.Item label="账单" name="billId" rules={[{ required: true }]}>
            <Select placeholder="请选择账单" />
          </Form.Item>
          <Form.Item label="收款金额" name="amount" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: "100%" }} prefix="¥" />
          </Form.Item>
          <Form.Item label="收款日期" name="paidAt" rules={[{ required: true }]}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="收款方式" name="method" rules={[{ required: true }]}>
            <Select
              placeholder="请选择收款方式"
              options={[
                { label: "现金", value: "CASH" },
                { label: "微信", value: "WECHAT" },
                { label: "支付宝", value: "ALIPAY" },
                { label: "银行转账", value: "BANK" },
              ]}
            />
          </Form.Item>
          <Form.Item label="备注" name="note">
            <Input.TextArea />
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
