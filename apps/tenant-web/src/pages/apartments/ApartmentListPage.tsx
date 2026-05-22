import { useState, useEffect, useCallback } from "react";
import { Button, Card, Empty, Tag, Spin, message, Popconfirm } from "antd";
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, HomeOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAppSession, useHasPermission } from "@/context/AppSessionContext";
import { getApartments, deleteApartment } from "@/api/apartments";
import type { Apartment } from "@/types/domain";
import { money, day } from "@/utils/format";
import { apartmentMonthlyIncome, apartmentMonthlyExpense } from "./utils";

export default function ApartmentListPage() {
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageApartment = useHasPermission("apartment:manage");

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(false);

  const loadApartments = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const data = await getApartments(currentOrgId);
      setApartments(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "加载公寓列表失败");
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    loadApartments();
  }, [loadApartments]);

  const handleDelete = async (id: string) => {
    if (!currentOrgId) return;
    try {
      await deleteApartment(currentOrgId, id);
      message.success("公寓已删除");
      loadApartments();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "删除公寓失败");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>公寓管理</h2>
        {canManageApartment && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/apartments/new")}>
            新增公寓
          </Button>
        )}
      </div>

      <Spin spinning={loading}>
        {apartments.length === 0 ? (
          <Card>
            <Empty description="暂无公寓数据" />
          </Card>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {apartments.map((apt) => {
              const roomCount = apt.rooms?.length ?? 0;
              const occupiedCount = apt.rooms?.filter((r) => r.status === "OCCUPIED").length ?? 0;
              const income = apartmentMonthlyIncome(apt);
              const expense = apartmentMonthlyExpense(apt);

              return (
                <Card
                  key={apt.id}
                  title={
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <HomeOutlined />
                      <span>{apt.name}</span>
                    </div>
                  }
                  extra={
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/apartments/${apt.id}`)}>
                        详情
                      </Button>
                      {canManageApartment && (
                        <>
                          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => navigate(`/apartments/${apt.id}/edit`)}>
                            编辑
                          </Button>
                          <Popconfirm
                            title="删除公寓"
                            description="删除后公寓及下属所有房间资料不可恢复，请确认当前公寓没有有效租约。"
                            onConfirm={() => handleDelete(apt.id)}
                            okText="确认删除"
                            cancelText="取消"
                            okButtonProps={{ danger: true }}
                          >
                            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                              删除
                            </Button>
                          </Popconfirm>
                        </>
                      )}
                    </div>
                  }
                >
                  <div style={{ marginBottom: 8 }}>
                    <Tag color="blue">{apt.location || "未填写地址"}</Tag>
                    <Tag>{apt.floors} 层</Tag>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#888" }}>房间数</div>
                      <div style={{ fontSize: 16, fontWeight: 500 }}>{roomCount} 间</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#888" }}>在租</div>
                      <div style={{ fontSize: 16, fontWeight: 500 }}>{occupiedCount} 间</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#888" }}>本月收入</div>
                      <div style={{ fontSize: 16, fontWeight: 500, color: "#52c41a" }}>¥{money(income)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#888" }}>本月支出</div>
                      <div style={{ fontSize: 16, fontWeight: 500, color: "#ff4d4f" }}>¥{money(expense)}</div>
                    </div>
                  </div>
                  {apt.contractStart && (
                    <div style={{ marginTop: 12, fontSize: 12, color: "#888" }}>
                      合同期：{day(apt.contractStart)} 至 {day(apt.contractEnd)}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </Spin>
    </div>
  );
}
