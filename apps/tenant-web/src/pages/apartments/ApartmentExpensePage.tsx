import { Card, Empty, Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useParams } from "react-router-dom";

export default function ApartmentExpensePage() {
  useParams<{ id: string }>();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>支出记录</h2>
        <Button type="primary" icon={<PlusOutlined />}>
          新增支出
        </Button>
      </div>
      <Card>
        <Empty description="暂无支出记录" />
      </Card>
    </div>
  );
}
