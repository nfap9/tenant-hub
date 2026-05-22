import { Button, Card, Empty } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

export default function ApartmentListPage() {
  const navigate = useNavigate();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>公寓管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/apartments/new")}>
          新增公寓
        </Button>
      </div>
      <Card>
        <Empty description="暂无公寓数据" />
      </Card>
    </div>
  );
}
