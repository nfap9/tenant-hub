import { Card, Form, Select, DatePicker, InputNumber, Input, Button, message } from "antd";
import { SaveOutlined } from "@ant-design/icons";

export default function ReadingPage() {
  const [form] = Form.useForm();

  const handleSubmit = async (values: unknown) => {
    console.log(values);
    message.success("抄表录入成功");
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>抄表录入</h2>
      <Card>
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ maxWidth: 600 }}>
          <Form.Item label="房间" name="roomId" rules={[{ required: true }]}>
            <Select placeholder="请选择房间" />
          </Form.Item>
          <Form.Item label="表类型" name="meterType" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "水表", value: "WATER" },
                { label: "电表", value: "POWER" },
              ]}
            />
          </Form.Item>
          <Form.Item label="抄表日期" name="readingDate" rules={[{ required: true }]}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="读数" name="value" rules={[{ required: true }]}>
            <InputNumber style={{ width: "100%" }} />
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
