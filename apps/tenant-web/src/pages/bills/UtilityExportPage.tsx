import { Card, Form, Select, DatePicker, Button } from "antd";
import { DownloadOutlined } from "@ant-design/icons";

export default function UtilityExportPage() {
  const [form] = Form.useForm();

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>导出水电数据</h2>
      <Card>
        <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
          <Form.Item label="公寓" name="apartmentId">
            <Select placeholder="全部公寓" />
          </Form.Item>
          <Form.Item label="月份" name="month">
            <DatePicker.MonthPicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<DownloadOutlined />}>
              导出
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
