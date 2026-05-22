import { Card, Form, DatePicker, InputNumber, Input, Button, message, Radio } from "antd";
import { useParams, useNavigate } from "react-router-dom";
import { CheckOutlined } from "@ant-design/icons";

export default function LeaseTerminatePage() {
  useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const handleSubmit = async (values: unknown) => {
    console.log(values);
    message.success("退租结算成功");
    navigate("/rooms");
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>退租结算</h2>
      <Card>
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ maxWidth: 600 }}>
          <Form.Item label="退租类型" name="type" rules={[{ required: true }]}>
            <Radio.Group
              options={[
                { label: "到期退租", value: "EXPIRED" },
                { label: "协商退租", value: "NEGOTIATED" },
                { label: "违约退租", value: "BREACH" },
              ]}
            />
          </Form.Item>
          <Form.Item label="退租日期" name="terminatedAt" rules={[{ required: true }]}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="水表读数（上期）" name="previousWater">
            <InputNumber style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="水表读数（本期）" name="currentWater">
            <InputNumber style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="电表读数（上期）" name="previousPower">
            <InputNumber style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="电表读数（本期）" name="currentPower">
            <InputNumber style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="押金扣减金额" name="depositDeductionAmount">
            <InputNumber min={0} style={{ width: "100%" }} prefix="¥" />
          </Form.Item>
          <Form.Item label="押金扣减原因" name="depositDeductionReason">
            <Input.TextArea />
          </Form.Item>
          <Form.Item label="其他费用" name="otherFeeAmount">
            <InputNumber min={0} style={{ width: "100%" }} prefix="¥" />
          </Form.Item>
          <Form.Item label="其他费用说明" name="otherFeeReason">
            <Input.TextArea />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<CheckOutlined />}>
              确认结算
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
