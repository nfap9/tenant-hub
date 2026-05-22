import { Card, Form, Input, Button, InputNumber, message } from "antd";
import { useParams, useNavigate } from "react-router-dom";
import { SaveOutlined } from "@ant-design/icons";


export default function ApartmentFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form] = Form.useForm();

  const handleSubmit = async (values: unknown) => {
    console.log(values);
    message.success(isEdit ? "更新成功" : "创建成功");
    navigate("/apartments");
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>{isEdit ? "编辑公寓" : "新增公寓"}</h2>
      <Card>
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ maxWidth: 600 }}>
          <Form.Item label="公寓名称" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="地址" name="location" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="楼层数" name="floors" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="房东姓名" name="landlordName">
            <Input />
          </Form.Item>
          <Form.Item label="房东电话" name="landlordPhone">
            <Input />
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
