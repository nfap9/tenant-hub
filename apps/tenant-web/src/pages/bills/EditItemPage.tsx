import { Card, Form, Input, InputNumber, Select, Button, message } from "antd";
import { useParams, useNavigate } from "react-router-dom";
import { SaveOutlined } from "@ant-design/icons";

export default function EditItemPage() {
  useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const handleSubmit = async (values: unknown) => {
    console.log(values);
    message.success("保存成功");
    navigate(-1);
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>编辑账单项目</h2>
      <Card>
        <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ maxWidth: 600 }}>
          <Form.Item label="费用类型" name="type" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "租金", value: "RENT" },
                { label: "水费", value: "WATER" },
                { label: "电费", value: "POWER" },
                { label: "押金", value: "DEPOSIT" },
                { label: "管理费", value: "MANAGEMENT" },
                { label: "其他", value: "OTHER" },
              ]}
            />
          </Form.Item>
          <Form.Item label="名称" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="金额" name="amount" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: "100%" }} prefix="¥" />
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
