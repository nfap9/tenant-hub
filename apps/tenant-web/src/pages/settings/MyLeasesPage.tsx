import { Card, Empty } from "antd";

export default function MyLeasesPage() {
  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>我的租约</h2>
      <Card>
        <Empty description="暂无租约" />
      </Card>
    </div>
  );
}
