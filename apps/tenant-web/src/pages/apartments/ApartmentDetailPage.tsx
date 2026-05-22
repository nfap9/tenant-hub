import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, Button, Tabs, Tag, message, Popconfirm, Spin } from "antd";
import { useParams, useNavigate } from "react-router-dom";
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  AppstoreAddOutlined,
  HomeOutlined,
  EnvironmentOutlined,
  BuildOutlined,
  AreaChartOutlined,
  UserOutlined,
  PhoneOutlined,
  CalendarOutlined,
  DollarOutlined,
} from "@ant-design/icons";
import { useAppSession, useHasPermission } from "@/context/AppSessionContext";
import { getApartments, deleteApartment } from "@/api/apartments";
import type { Apartment, Room } from "@/types/domain";
import { money, facilitiesText } from "@/utils/format";
import { contractText } from "./utils";
import { statusLabels, toneForStatus } from "./constants";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

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
      <div className="page-content">
        <PageHeader
          back="/apartments"
          breadcrumb={[{ label: "公寓管理", path: "/apartments" }, { label: "公寓详情" }]}
        />
        <Card>
          <EmptyState title="公寓不存在或已删除" description="该公寓可能已被删除或您没有访问权限" />
        </Card>
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
    <div className="page-content">
      <PageHeader
        back="/apartments"
        breadcrumb={[
          { label: "公寓管理", path: "/apartments" },
          { label: apartment.name },
        ]}
        actions={
          canManageApartment && (
            <div style={{ display: "flex", gap: 8 }}>
              <Button icon={<EditOutlined />} onClick={() => navigate(`/apartments/${id}/edit`)}>
                编辑
              </Button>
              <Popconfirm
                title="删除公寓"
                description="删除后公寓及下属所有房间资料不可恢复，请确认当前公寓没有有效租约。"
                onConfirm={handleDeleteApartment}
                okText="确认删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            </div>
          )
        }
      />

      <Spin spinning={loading}>
        <Tabs
          items={[
            {
              key: "detail",
              label: "公寓详情",
              children: (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 24 }}>
                  <Card
                    title={
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <HomeOutlined style={{ color: "var(--th-primary)" }} />
                        基本信息
                      </div>
                    }
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <EnvironmentOutlined style={{ color: "var(--th-foreground-subtle)" }} />
                        <span style={{ color: "var(--th-foreground-muted)", minWidth: 70 }}>地址</span>
                        <span style={{ fontWeight: 500 }}>{apartment.location || "未填写"}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <BuildOutlined style={{ color: "var(--th-foreground-subtle)" }} />
                        <span style={{ color: "var(--th-foreground-muted)", minWidth: 70 }}>楼层数</span>
                        <span style={{ fontWeight: 500 }}>{apartment.floors} 层</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <AreaChartOutlined style={{ color: "var(--th-foreground-subtle)" }} />
                        <span style={{ color: "var(--th-foreground-muted)", minWidth: 70 }}>占地面积</span>
                        <span style={{ fontWeight: 500 }}>{apartment.landArea ? `${apartment.landArea} ㎡` : "未填"}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <AreaChartOutlined style={{ color: "var(--th-foreground-subtle)" }} />
                        <span style={{ color: "var(--th-foreground-muted)", minWidth: 70 }}>总面积</span>
                        <span style={{ fontWeight: 500 }}>{apartment.totalArea ? `${apartment.totalArea} ㎡` : "未填"}</span>
                      </div>
                    </div>
                  </Card>

                  <Card
                    title={
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <UserOutlined style={{ color: "var(--th-primary)" }} />
                        上游信息
                      </div>
                    }
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <UserOutlined style={{ color: "var(--th-foreground-subtle)" }} />
                        <span style={{ color: "var(--th-foreground-muted)", minWidth: 70 }}>房东姓名</span>
                        <span style={{ fontWeight: 500 }}>{apartment.landlordName || "未维护"}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <PhoneOutlined style={{ color: "var(--th-foreground-subtle)" }} />
                        <span style={{ color: "var(--th-foreground-muted)", minWidth: 70 }}>联系方式</span>
                        <span style={{ fontWeight: 500 }}>{apartment.landlordPhone || "未维护"}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <CalendarOutlined style={{ color: "var(--th-foreground-subtle)" }} />
                        <span style={{ color: "var(--th-foreground-muted)", minWidth: 70 }}>合同期</span>
                        <span style={{ fontWeight: 500 }}>{contractText(apartment)}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <DollarOutlined style={{ color: "var(--th-foreground-subtle)" }} />
                        <span style={{ color: "var(--th-foreground-muted)", minWidth: 70 }}>上游租金</span>
                        <span style={{ fontWeight: 500 }}>¥{money(apartment.rentAmount)}</span>
                      </div>
                    </div>
                  </Card>

                  <Card
                    title={
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <DollarOutlined style={{ color: "var(--th-primary)" }} />
                        经营花费
                      </div>
                    }
                    extra={
                      canManageApartment && (
                        <Button
                          type="primary"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => navigate(`/apartments/${id}/expenses`)}
                        >
                          记录花费
                        </Button>
                      )
                    }
                  >
                    {(apartment.expenses ?? []).length === 0 ? (
                      <EmptyState
                        title="暂无经营花费记录"
                        description="点击右上角按钮记录第一笔经营花费"
                        action={
                          canManageApartment
                            ? { label: "记录花费", onClick: () => navigate(`/apartments/${id}/expenses`) }
                            : undefined
                        }
                      />
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {(apartment.expenses ?? []).map((item) => (
                          <div
                            key={item.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "12px 16px",
                              borderRadius: "var(--th-radius-sm)",
                              background: "var(--th-surface-hover)",
                            }}
                          >
                            <span style={{ color: "var(--th-foreground)" }}>
                              {item.name} · {item.spentAt.slice(0, 10)}
                            </span>
                            <span style={{ fontWeight: 600, color: "var(--th-danger)" }}>¥{money(item.amount)}</span>
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
                  title={
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "var(--th-font-heading)", fontWeight: 600 }}>房间概览</span>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          fontSize: 13,
                          fontWeight: 500,
                          color: "var(--th-foreground-muted)",
                        }}
                      >
                        <span>共 {apartmentRooms.length} 间</span>
                        <span>·</span>
                        <span style={{ color: "var(--th-success)" }}>空闲 {apartmentVacantRooms} 间</span>
                        <span>·</span>
                        <span style={{ color: "var(--th-warning)" }}>已租 {apartmentOccupiedRooms} 间</span>
                      </div>
                    </div>
                  }
                  extra={
                    canManageRoom && (
                      <div style={{ display: "flex", gap: 8 }}>
                        <Button icon={<PlusOutlined />} onClick={() => navigate(`/rooms/new?apartmentId=${id}`)}>
                          新增房间
                        </Button>
                        <Button icon={<AppstoreAddOutlined />} onClick={() => navigate(`/apartments/${id}/rooms/batch`)}>
                          批量添加
                        </Button>
                      </div>
                    )
                  }
                >
                  {apartmentRooms.length === 0 ? (
                    <EmptyState
                      title="暂无房间"
                      description="可以新增单个房间或批量添加"
                      action={
                        canManageRoom
                          ? { label: "新增房间", onClick: () => navigate(`/rooms/new?apartmentId=${id}`) }
                          : undefined
                      }
                    />
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
                      {apartmentRooms.map((room) => (
                        <Card
                          key={room.id}
                          size="small"
                          hoverable
                          title={
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontWeight: 600, fontFamily: "var(--th-font-heading)" }}>{room.roomNo}</span>
                              <Tag color={statusColorMap[toneForStatus[room.status]]}>{statusLabels[room.status]}</Tag>
                            </div>
                          }
                        >
                          <div style={{ marginBottom: 8, color: "var(--th-foreground-muted)" }}>
                            {room.layout} · {room.area ? `${room.area} ㎡` : "未填面积"}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--th-foreground-subtle)", marginBottom: 12 }}>
                            {facilitiesText(room.facilities)}
                          </div>
                          {canManageRoom && (
                            <div style={{ display: "flex", gap: 8 }}>
                              <Button
                                size="small"
                                onClick={() => navigate(`/rooms/${room.id}/edit?apartmentId=${id}`)}
                              >
                                编辑
                              </Button>
                              <Popconfirm
                                title="删除房间"
                                description="删除后房间资料不可恢复，请确认当前房间没有有效租约。"
                                onConfirm={() => handleDeleteRoom(room)}
                                okText="确认删除"
                                cancelText="取消"
                                disabled={room.status === "OCCUPIED"}
                              >
                                <Button size="small" danger disabled={room.status === "OCCUPIED"}>
                                  删除
                                </Button>
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
