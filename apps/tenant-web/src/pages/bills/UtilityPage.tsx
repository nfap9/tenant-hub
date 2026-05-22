import { Card, Form, Select, DatePicker, Button, message } from "antd";
import { ThunderboltOutlined } from "@ant-design/icons";

export default function UtilityPage() {
  const [form] = Form.useForm();

  const handleSubmit = async (values: unknown) => {
    console.log(values);
    message.success("水电账单生成成功");
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>水电账单生成</h2>
      <Card>
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ maxWidth: 600 }}>
          <Form.Item label="公寓" name="apartmentId" rules={[{ required: true }]}>
            <Select placeholder="请选择公寓" />
          </Form.Item>
          <Form.Item label="计费月份" name="month" rules={[{ required: true }]}>
            <DatePicker.MonthPicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<ThunderboltOutlined />}>
              生成账单
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
