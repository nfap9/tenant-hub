import { useState, useEffect, useCallback } from "react";
import { Button, Card, Tag, Spin, message, Popconfirm, Tooltip } from "antd";
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, HomeOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAppSession, useHasPermission } from "@/context/AppSessionContext";
import { getApartments, deleteApartment } from "@/api/apartments";
import type { Apartment } from "@/types/domain";
import { money, day } from "@/utils/format";
import { apartmentMonthlyIncome, apartmentMonthlyExpense } from "./utils";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

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
    <div className="page-content">
      <PageHeader
        breadcrumb={[{ label: "公寓管理" }]}
        actions={
          canManageApartment && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/apartments/new")}>
              新增公寓
            </Button>
          )
        }
      />

      <Spin spinning={loading}>
        {apartments.length === 0 ? (
          <Card>
            <EmptyState
              title="暂无公寓数据"
              description="当前组织下还没有创建任何公寓，点击右上角按钮创建第一个公寓"
              action={
                canManageApartment
                  ? { label: "新增公寓", onClick: () => navigate("/apartments/new") }
                  : undefined
              }
            />
          </Card>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 24 }}>
            {apartments.map((apt) => {
              const roomCount = apt.rooms?.length ?? 0;
              const occupiedCount = apt.rooms?.filter((r) => r.status === "OCCUPIED").length ?? 0;
              const income = apartmentMonthlyIncome(apt);
              const expense = apartmentMonthlyExpense(apt);

              return (
                <Card
                  key={apt.id}
                  hoverable
                  title={
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <HomeOutlined style={{ color: "var(--th-primary)" }} />
                      <span style={{ fontFamily: "var(--th-font-heading)", fontWeight: 600 }}>{apt.name}</span>
                    </div>
                  }
                  extra={
                    <div style={{ display: "flex", gap: 4 }}>
                      <Tooltip title="详情">
                        <Button
                          type="text"
                          size="small"
                          icon={<EyeOutlined />}
                          onClick={() => navigate(`/apartments/${apt.id}`)}
                        />
                      </Tooltip>
                      {canManageApartment && (
                        <>
                          <Tooltip title="编辑">
                            <Button
                              type="text"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => navigate(`/apartments/${apt.id}/edit`)}
                            />
                          </Tooltip>
                          <Popconfirm
                            title="删除公寓"
                            description="删除后公寓及下属所有房间资料不可恢复，请确认当前公寓没有有效租约。"
                            onConfirm={() => handleDelete(apt.id)}
                            okText="确认删除"
                            cancelText="取消"
                            okButtonProps={{ danger: true }}
                          >
                            <Tooltip title="删除">
                              <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                            </Tooltip>
                          </Popconfirm>
                        </>
                      )}
                    </div>
                  }
                >
                  <div style={{ marginBottom: 16 }}>
                    <Tag color="blue">{apt.location || "未填写地址"}</Tag>
                    <Tag
                      style={{
                        color: "var(--th-foreground-muted)",
                        background: "var(--th-surface-hover)",
                        borderColor: "var(--th-border)",
                      }}
                    >
                      {apt.floors} 层
                    </Tag>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 16,
                      padding: "var(--th-space-4)",
                      background: "var(--th-bg)",
                      borderRadius: "var(--th-radius)",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, color: "var(--th-foreground-muted)", marginBottom: 4 }}>房间数</div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          fontFamily: "var(--th-font-heading)",
                          color: "var(--th-foreground)",
                        }}
                      >
                        {roomCount} 间
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--th-foreground-muted)", marginBottom: 4 }}>在租</div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          fontFamily: "var(--th-font-heading)",
                          color: "var(--th-foreground)",
                        }}
                      >
                        {occupiedCount} 间
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--th-foreground-muted)", marginBottom: 4 }}>本月收入</div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          fontFamily: "var(--th-font-heading)",
                          color: "var(--th-success)",
                        }}
                      >
                        ¥{money(income)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--th-foreground-muted)", marginBottom: 4 }}>本月支出</div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          fontFamily: "var(--th-font-heading)",
                          color: "var(--th-danger)",
                        }}
                      >
                        ¥{money(expense)}
                      </div>
                    </div>
                  </div>
                  {apt.contractStart && (
                    <div style={{ marginTop: 16, fontSize: 13, color: "var(--th-foreground-muted)" }}>
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
