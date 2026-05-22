import { Button, Card, Empty, Tabs } from "antd";
import { PlusOutlined } from "@ant-design/icons";

export default function BillListPage() {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>账单管理</h2>
        <Button type="primary" icon={<PlusOutlined />}>
          新增账单
        </Button>
      </div>
      <Card>
        <Tabs
          items={[
            { key: "unpaid", label: "未付", children: <Empty description="暂无未付账单" /> },
            { key: "pending", label: "待审核", children: <Empty description="暂无待审核账单" /> },
            { key: "all", label: "全部", children: <Empty description="暂无账单" /> },
          ]}
        />
      </Card>
    </div>
  );
}
