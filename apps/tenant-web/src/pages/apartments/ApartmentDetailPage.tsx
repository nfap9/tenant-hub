import { Card, Empty, Button } from "antd";
import { useParams, useNavigate } from "react-router-dom";
import { EditOutlined, DeleteOutlined } from "@ant-design/icons";

export default function ApartmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>公寓详情</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <Button icon={<EditOutlined />} onClick={() => navigate(`/apartments/${id}/edit`)}>
            编辑
          </Button>
          <Button danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </div>
      </div>
      <Card>
        <Empty description="待实现" />
      </Card>
    </div>
  );
}
