import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, Empty, Button, Tabs, Tag, message, Popconfirm, Spin } from "antd";
import { useParams, useNavigate } from "react-router-dom";
import { EditOutlined, DeleteOutlined, PlusOutlined, ArrowLeftOutlined, AppstoreAddOutlined } from "@ant-design/icons";
import { useAppSession, useHasPermission } from "@/context/AppSessionContext";
import { getApartments, deleteApartment } from "@/api/apartments";
import type { Apartment, Room } from "@/types/domain";
import { money, facilitiesText } from "@/utils/format";
import { contractText } from "./utils";
import { statusLabels, toneForStatus } from "./constants";

export default function ApartmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrgId } = useAppSession();
  const canManageApartment = useHasPermission("apartment:manage");
  const canManageRoom = useHasPermission("room:manage");

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(false);

  const loadApartments = useCallback(async () => {
    if (!currentOrgId) return;
    setLoading(true);
    try {
      const data = await getApartments(currentOrgId);
      setApartments(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    loadApartments();
  }, [loadApartments]);

  const apartment = useMemo(() => apartments.find((a) => a.id === id), [apartments, id]);
  const apartmentRooms = useMemo(
    () => [...(apartment?.rooms ?? [])].sort((left, right) => left.roomNo.localeCompare(right.roomNo, "zh-Hans-CN")),
    [apartment]
  );

  const apartmentVacantRooms = useMemo(() => apartmentRooms.filter((room) => room.status === "VACANT").length, [apartmentRooms]);
  const apartmentOccupiedRooms = useMemo(() => apartmentRooms.filter((room) => room.status === "OCCUPIED").length, [apartmentRooms]);

  const handleDeleteApartment = async () => {
    if (!apartment || !currentOrgId) return;
    try {
      await deleteApartment(currentOrgId, apartment.id);
      message.success("公寓已删除");
      navigate("/apartments");
    } catch (e) {
      message.error(e instanceof Error ? e.message : "删除公寓失败");
    }
  };

  const handleDeleteRoom = async (room: Room) => {
    if (!currentOrgId) return;
    if (room.status === "OCCUPIED") {
      message.warning("已租房间不能删除，请先退租");
      return;
    }
    try {
      const { deleteRoom } = await import("@/api/rooms");
      await deleteRoom(currentOrgId, room.id);
      message.success("房间已删除");
      loadApartments();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "删除房间失败");
    }
  };

  if (!apartment) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/apartments")}>返回</Button>
          <h2 style={{ margin: 0 }}>公寓详情</h2>
        </div>
        <Card><Empty description="公寓不存在或已删除" /></Card>
      </div>
    );
  }

  const statusColorMap: Record<string, string> = {
    success: "success",
    neutral: "default",
    warning: "warning",
    danger: "error",
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/apartments")}>返回</Button>
          <h2 style={{ margin: 0 }}>{apartment.name}</h2>
        </div>
        {canManageApartment && (
          <div style={{ display: "flex", gap: 8 }}>
            <Button icon={<EditOutlined />} onClick={() => navigate(`/apartments/${id}/edit`)}>编辑</Button>
            <Popconfirm
              title="删除公寓"
              description="删除后公寓及下属所有房间资料不可恢复，请确认当前公寓没有有效租约。"
              onConfirm={handleDeleteApartment}
              okText="确认删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          </div>
        )}
      </div>

      <Spin spinning={loading}>
        <Tabs
          items={[
            {
              key: "detail",
              label: "公寓详情",
              children: (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                  <Card title="基本信息">
                    <div style={{ lineHeight: 2 }}>
                      <div><strong>地址：</strong>{apartment.location}</div>
                      <div><strong>楼层数：</strong>{apartment.floors} 层</div>
                      <div><strong>占地面积：</strong>{apartment.landArea ? `${apartment.landArea} ㎡` : "未填"}</div>
                      <div><strong>总面积：</strong>{apartment.totalArea ? `${apartment.totalArea} ㎡` : "未填"}</div>
                    </div>
                  </Card>
                  <Card title="上游信息">
                    <div style={{ lineHeight: 2 }}>
                      <div><strong>房东姓名：</strong>{apartment.landlordName || "未维护"}</div>
                      <div><strong>联系方式：</strong>{apartment.landlordPhone || "未维护"}</div>
                      <div><strong>合同期：</strong>{contractText(apartment)}</div>
                      <div><strong>上游租金：</strong>¥{money(apartment.rentAmount)}</div>
                    </div>
                  </Card>
                  <Card
                    title="经营花费"
                    extra={canManageApartment && (
                      <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => navigate(`/apartments/${id}/expenses`)}>
                        记录花费
                      </Button>
                    )}
                  >
                    {(apartment.expenses ?? []).length === 0 ? (
                      <Empty description="暂无经营花费记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {(apartment.expenses ?? []).map((item) => (
                          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
                            <span>{item.name} · {item.spentAt.slice(0, 10)}</span>
                            <span style={{ fontWeight: 500, color: "#ff4d4f" }}>¥{money(item.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              ),
            },
            {
              key: "rooms",
              label: `房间列表 (${apartmentRooms.length})`,
              children: (
                <Card
                  title={`共 ${apartmentRooms.length} 间 · 空闲 ${apartmentVacantRooms} 间 · 已租 ${apartmentOccupiedRooms} 间`}
                  extra={canManageRoom && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button icon={<PlusOutlined />} onClick={() => navigate(`/rooms/new?apartmentId=${id}`)}>新增房间</Button>
                      <Button icon={<AppstoreAddOutlined />} onClick={() => navigate(`/apartments/${id}/rooms/batch`)}>批量添加</Button>
                    </div>
                  )}
                >
                  {apartmentRooms.length === 0 ? (
                    <Empty description="暂无房间，可以新增单个房间或批量添加" />
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
                      {apartmentRooms.map((room) => (
                        <Card
                          key={room.id}
                          size="small"
                          title={
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span>{room.roomNo}</span>
                              <Tag color={statusColorMap[toneForStatus[room.status]]}>{statusLabels[room.status]}</Tag>
                            </div>
                          }
                        >
                          <div style={{ marginBottom: 8, color: "#666" }}>
                            {room.layout} · {room.area ? `${room.area} ㎡` : "未填面积"}
                          </div>
                          <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
                            {facilitiesText(room.facilities)}
                          </div>
                          {canManageRoom && (
                            <div style={{ display: "flex", gap: 8 }}>
                              <Button size="small" onClick={() => navigate(`/rooms/${room.id}/edit?apartmentId=${id}`)}>编辑</Button>
                              <Popconfirm
                                title="删除房间"
                                description="删除后房间资料不可恢复，请确认当前房间没有有效租约。"
                                onConfirm={() => handleDeleteRoom(room)}
                                okText="确认删除"
                                cancelText="取消"
                                disabled={room.status === "OCCUPIED"}
                              >
                                <Button size="small" danger disabled={room.status === "OCCUPIED"}>删除</Button>
                              </Popconfirm>
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}
                </Card>
              ),
            },
          ]}
        />
      </Spin>
    </div>
  );
}
