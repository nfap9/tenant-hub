import { Card, Empty } from "antd";

export default function PlanPage() {
  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>套餐订阅</h2>
      <Card>
        <Empty description="暂无订阅信息" />
      </Card>
    </div>
  );
}
