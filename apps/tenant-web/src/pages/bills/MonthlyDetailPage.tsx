import { Card, Empty, Button } from "antd";
import { useParams } from "react-router-dom";
import { PrinterOutlined } from "@ant-design/icons";

export default function MonthlyDetailPage() {
  useParams<{ id: string }>();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>月账单详情</h2>
        <Button icon={<PrinterOutlined />}>打印</Button>
      </div>
      <Card>
        <Empty description="暂无数据" />
      </Card>
    </div>
  );
}
