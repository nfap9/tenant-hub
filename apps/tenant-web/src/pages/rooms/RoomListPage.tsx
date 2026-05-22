import { Button, Card, Empty } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

export default function RoomListPage() {
  const navigate = useNavigate();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>房间管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/rooms/new")}>
          新增房间
        </Button>
      </div>
      <Card>
        <Empty description="暂无房间数据" />
      </Card>
    </div>
  );
}
