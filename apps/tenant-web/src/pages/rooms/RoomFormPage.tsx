import { useState, useEffect, useRef, useMemo } from "react";
import { Card, Form, Input, InputNumber, Select, Button, message, Spin } from "antd";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { SaveOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { useAppSession, useHasPermission } from "@/context/AppSessionContext";
import { getApartments } from "@/api/apartments";
import { createRoom, updateRoom } from "@/api/rooms";
import type { Apartment, Room } from "@/types/domain";
import { optionalNumber, toFacilityArray } from "@/utils/format";
import { emptyRoomForm, roomStatuses, statusLabels } from "./constants";
import { roomLayoutOptions } from "@/pages/apartments/constants";

export default function RoomFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentOrgId } = useAppSession();
  const canManageRoom = useHasPermission("room:manage");
  const isEdit = Boolean(id);
  const [form] = Form.useForm();

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const initializedRef = useRef(false);

  const urlApartmentId = searchParams.get("apartmentId");

  useEffect(() => {
    if (!currentOrgId) return;
    setLoading(true);
    getApartments(currentOrgId)
      .then((data) => {
        setApartments(data);
        const allRooms = data.flatMap((a) => a.rooms ?? []);
        setRooms(allRooms);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [currentOrgId]);

  const editingRoom = useMemo(() => {
    if (!id) return undefined;
    return rooms.find((r) => r.id === id);
  }, [rooms, id]);

  useEffect(() => {
    if (isEdit && editingRoom && !initializedRef.current) {
      form.setFieldsValue({
        apartmentId: editingRoom.apartmentId,
        roomNo: editingRoom.roomNo,
        layout: editingRoom.layout,
        area: editingRoom.area ? Number(editingRoom.area) : undefined,
        facilities: editingRoom.facilities?.join(",") ?? "",
        status: editingRoom.status,
      });
      initializedRef.current = true;
    }
    if (!isEdit) {
      form.setFieldsValue({
        apartmentId: urlApartmentId || undefined,
        ...emptyRoomForm,
      });
      initializedRef.current = false;
    }
  }, [isEdit, editingRoom, form, urlApartmentId]);

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!currentOrgId) return;
    if (!canManageRoom) { message.warning("当前角色没有管理房间权限"); return; }
    if (!values.roomNo || !values.layout) { message.warning("请填写房间号和户型"); return; }

    setSaving(true);
    try {
      if (isEdit) {
        await updateRoom(currentOrgId, id!, {
          roomNo: String(values.roomNo).trim(),
          layout: String(values.layout).trim(),
          area: optionalNumber(values.area),
          facilities: toFacilityArray(String(values.facilities)),
          status: String(values.status),
        });
        message.success("房间信息已更新");
        navigate("/rooms");
      } else {
        const apartmentId = String(values.apartmentId);
        if (!apartmentId) { message.warning("请选择所属公寓"); return; }
        await createRoom(currentOrgId, apartmentId, {
          roomNo: String(values.roomNo).trim(),
          layout: String(values.layout).trim(),
          area: optionalNumber(values.area),
          facilities: toFacilityArray(String(values.facilities)),
        });
        message.success("房间已添加");
        if (urlApartmentId) {
          navigate(`/apartments/${urlApartmentId}`);
        } else {
          navigate("/rooms");
        }
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : (isEdit ? "更新房间失败" : "添加房间失败"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(isEdit ? "/rooms" : urlApartmentId ? `/apartments/${urlApartmentId}` : "/rooms")}>
          返回
        </Button>
        <h2 style={{ margin: 0 }}>{isEdit ? "编辑房间" : "新增房间"}</h2>
      </div>
      <Spin spinning={loading}>
        <Card style={{ maxWidth: 600 }}>
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item label="所属公寓" name="apartmentId" rules={[{ required: !isEdit, message: "请选择公寓" }]}>
              <Select placeholder="请选择公寓" disabled={isEdit} options={apartments.map((a) => ({ label: a.name, value: a.id }))} />
            </Form.Item>
            <Form.Item label="房号" name="roomNo" rules={[{ required: true, message: "请输入房号" }]}>
              <Input placeholder="例如 301" />
            </Form.Item>
            <Form.Item label="户型" name="layout" rules={[{ required: true, message: "请选择户型" }]}>
              <Select placeholder="请选择户型" options={roomLayoutOptions.map((l) => ({ label: l, value: l }))} />
            </Form.Item>
            <Form.Item label="面积（㎡）" name="area">
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item label="设施" name="facilities">
              <Input placeholder="多个设施用逗号分隔，如：空调,热水器,洗衣机" />
            </Form.Item>
            {isEdit && (
              <Form.Item label="状态" name="status" rules={[{ required: true }]}>
                <Select options={roomStatuses.map((s) => ({ label: statusLabels[s], value: s }))} />
              </Form.Item>
            )}
            <Form.Item>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} disabled={saving}>
                {isEdit ? "保存修改" : "保存房间"}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Spin>
    </div>
  );
}
