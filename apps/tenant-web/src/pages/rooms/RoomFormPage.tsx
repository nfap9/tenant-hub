import { Card, Form, Input, InputNumber, Select, Button, message } from "antd";
import { useParams, useNavigate } from "react-router-dom";
import { SaveOutlined } from "@ant-design/icons";

export default function RoomFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form] = Form.useForm();

  const handleSubmit = async (values: unknown) => {
    console.log(values);
    message.success(isEdit ? "更新成功" : "创建成功");
    navigate("/rooms");
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>{isEdit ? "编辑房间" : "新增房间"}</h2>
      <Card>
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ maxWidth: 600 }}>
          <Form.Item label="所属公寓" name="apartmentId" rules={[{ required: true }]}>
            <Select placeholder="请选择公寓" />
          </Form.Item>
          <Form.Item label="房号" name="roomNo" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="户型" name="layout" rules={[{ required: true }]}>
            <Input placeholder="如：一室一厅" />
          </Form.Item>
          <Form.Item label="面积" name="area">
            <InputNumber min={0} style={{ width: "100%" }} suffix="m²" />
          </Form.Item>
          <Form.Item label="设施" name="facilities">
            <Input placeholder="多个设施用逗号分隔" />
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
