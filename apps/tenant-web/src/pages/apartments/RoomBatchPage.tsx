import { Card, Form, InputNumber, Button, message } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { useParams } from "react-router-dom";

export default function RoomBatchPage() {
  useParams<{ id: string }>();
  const [form] = Form.useForm();

  const handleSubmit = async (values: unknown) => {
    console.log(values);
    message.success("批量生成成功");
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>批量生成房间</h2>
      <Card>
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ maxWidth: 400 }}>
          <Form.Item label="起始楼层" name="startFloor" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="结束楼层" name="endFloor" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="每层房间数" name="roomCount" rules={[{ required: true }]}>
            <InputNumber min={1} max={200} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
              生成
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
