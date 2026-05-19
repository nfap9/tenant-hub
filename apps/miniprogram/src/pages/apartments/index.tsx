import { useState, useMemo, useCallback } from 'react';
import { View } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { useAppSession, useHasPermission } from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { NoOrganization } from '../../components/NoOrganization';
import { ApartmentList } from './components/ApartmentList';
import { ApartmentForm } from './components/ApartmentForm';
import { ApartmentDetail } from './components/ApartmentDetail';
import { ExpenseSheet } from './components/ExpenseSheet';
import { RoomSingleSheet } from './components/RoomSingleSheet';
import { RoomBatchSheet } from './components/RoomBatchSheet';
import { RoomEditSheet } from './components/RoomEditSheet';
import { DeleteConfirmSheet } from './components/DeleteConfirmSheet';
import { emptyApartmentForm } from './constants';
import { optionalNumber, optionalText, toFacilityArray } from '../../utils/format';
import type { Apartment, Room, RoomStatus } from '../../types/domain';
import './index.scss';

export default function ApartmentsPage() {
  const { currentOrgId } = useAppSession();
  const canManageApartment = useHasPermission("apartment:manage");
  const canManageRoom = useHasPermission("room:manage");

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [mode, setMode] = useState<"list" | "detail" | "edit" | "create">("list");
  const [detailTab, setDetailTab] = useState<"expenses" | "rooms">("expenses");
  const [layer, setLayer] = useState<"expense" | "roomSingle" | "roomBatch" | "roomEdit" | "roomDelete" | "apartmentDelete" | undefined>();
  const [expenseApartmentId, setExpenseApartmentId] = useState<string>();
  const [editingRoomId, setEditingRoomId] = useState<string>();
  const [deleteRoomId, setDeleteRoomId] = useState<string>();
  const [form, setForm] = useState(emptyApartmentForm);
  const [saving, setSaving] = useState(false);

  const selectedApartment = useMemo(() => apartments.find((item) => item.id === selectedId), [apartments, selectedId]);
  const apartmentRooms = useMemo(
    () => [...(selectedApartment?.rooms ?? [])].sort((left, right) => left.roomNo.localeCompare(right.roomNo, "zh-Hans-CN")),
    [selectedApartment]
  );
  const editingRoom = useMemo(() => apartmentRooms.find((room) => room.id === editingRoomId), [apartmentRooms, editingRoomId]);
  const deletingRoom = useMemo(() => apartmentRooms.find((room) => room.id === deleteRoomId), [apartmentRooms, deleteRoomId]);

  const loadApartments = useCallback(async () => {
    if (!currentOrgId) return;
    try {
      const data = await apiClient<Apartment[]>("/apartments", { organizationId: currentOrgId });
      setApartments(data);
      setSelectedId((old) => (old && data.some((item) => item.id === old) ? old : undefined));
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "加载失败", icon: "none" });
    }
  }, [currentOrgId]);

  useDidShow(() => {
    loadApartments();
  });

  usePullDownRefresh(() => {
    loadApartments().finally(() => Taro.stopPullDownRefresh());
  });

  const updateForm = (key: keyof typeof form, value: string) => setForm((old) => ({ ...old, [key]: value }));

  const resetRoomWork = () => {
    setLayer(undefined);
    setEditingRoomId(undefined);
    setDeleteRoomId(undefined);
  };

  const backToList = () => {
    setSelectedId(undefined);
    setLayer(undefined);
    setExpenseApartmentId(undefined);
    resetRoomWork();
    setDetailTab("expenses");
    setMode("list");
  };

  const openDetail = (apartmentId: string) => {
    setSelectedId(apartmentId);
    setLayer(undefined);
    setExpenseApartmentId(undefined);
    resetRoomWork();
    setDetailTab("expenses");
    setMode("detail");
  };

  const handleCreate = () => {
    setSelectedId(undefined);
    setForm(emptyApartmentForm);
    setMode("create");
  };

  const saveApartment = async () => {
    if (!currentOrgId) { Taro.showToast({ title: "请先选择组织", icon: "none" }); return; }
    if (!canManageApartment) { Taro.showToast({ title: "当前角色没有管理公寓权限", icon: "none" }); return; }
    if (!form.name.trim() || !form.location.trim()) { Taro.showToast({ title: "请填写公寓名称和位置", icon: "none" }); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        location: form.location.trim(),
        floors: Number(form.floors || 1),
        landArea: optionalNumber(form.landArea),
        totalArea: optionalNumber(form.totalArea),
        landlordName: optionalText(form.landlordName),
        landlordPhone: optionalText(form.landlordPhone),
        contractStart: optionalText(form.contractStart),
        contractEnd: optionalText(form.contractEnd),
        rentAmount: optionalNumber(form.rentAmount)
      };
      const path = selectedApartment ? `/apartments/${selectedApartment.id}` : "/apartments";
      const method = selectedApartment ? "PUT" : "POST";
      const saved = await apiClient<Apartment>(path, { method, body: payload, organizationId: currentOrgId });
      Taro.showToast({ title: selectedApartment ? "公寓信息已更新" : "公寓已创建", icon: "success" });
      setSelectedId(saved.id);
      await loadApartments();
      setMode("detail");
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "保存失败", icon: "none" });
    } finally {
      setSaving(false);
    }
  };

  const deleteApartment = async () => {
    if (!currentOrgId || !selectedApartment) return;
    if (!canManageApartment) { Taro.showToast({ title: "当前角色没有管理公寓权限", icon: "none" }); return; }
    try {
      await apiClient(`/apartments/${selectedApartment.id}`, { method: "DELETE", organizationId: currentOrgId });
      Taro.showToast({ title: "公寓已删除", icon: "success" });
      setLayer(undefined);
      backToList();
      await loadApartments();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "删除公寓失败", icon: "none" });
    }
  };

  const addExpense = async (expense: { name: string; amount: string; spentAt: string; note: string }) => {
    const apartmentId = expenseApartmentId ?? selectedApartment?.id;
    if (!currentOrgId || !apartmentId) return;
    if (!canManageApartment) { Taro.showToast({ title: "当前角色没有管理公寓权限", icon: "none" }); return; }
    if (!expense.name.trim() || !expense.amount.trim()) { Taro.showToast({ title: "请填写花费名称和金额", icon: "none" }); return; }
    try {
      await apiClient(`/apartments/${apartmentId}/expenses`, {
        method: "POST",
        body: { name: expense.name.trim(), amount: Number(expense.amount), spentAt: expense.spentAt, note: optionalText(expense.note) },
        organizationId: currentOrgId
      });
      Taro.showToast({ title: "经营花费已记录", icon: "success" });
      setLayer(undefined);
      setExpenseApartmentId(undefined);
      await loadApartments();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "记录花费失败", icon: "none" });
    }
  };

  const createRoom = async (roomForm: { roomNo: string; layout: string; area: string; facilities: string }) => {
    if (!currentOrgId || !selectedApartment) return;
    if (!canManageRoom) { Taro.showToast({ title: "当前角色没有管理房间权限", icon: "none" }); return; }
    if (!roomForm.roomNo.trim() || !roomForm.layout.trim()) { Taro.showToast({ title: "请填写房间号和户型", icon: "none" }); return; }
    try {
      const result = await apiClient<{ count: number }>(`/apartments/${selectedApartment.id}/rooms/batch`, {
        method: "POST",
        body: {
          rooms: [{
            roomNo: roomForm.roomNo.trim(),
            layout: roomForm.layout.trim(),
            area: optionalNumber(roomForm.area),
            facilities: toFacilityArray(roomForm.facilities)
          }]
        },
        organizationId: currentOrgId
      });
      Taro.showToast({ title: result.count > 0 ? "房间已添加" : "房间号已存在，未重复创建", icon: "success" });
      resetRoomWork();
      await loadApartments();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "添加房间失败", icon: "none" });
    }
  };

  const updateRoom = async (roomForm: { roomNo: string; layout: string; area: string; facilities: string; status: RoomStatus }) => {
    if (!currentOrgId || !editingRoomId) return;
    if (!canManageRoom) { Taro.showToast({ title: "当前角色没有管理房间权限", icon: "none" }); return; }
    if (!roomForm.roomNo.trim() || !roomForm.layout.trim()) { Taro.showToast({ title: "请填写房间号和户型", icon: "none" }); return; }
    try {
      await apiClient(`/apartments/rooms/${editingRoomId}`, {
        method: "PUT",
        body: {
          roomNo: roomForm.roomNo.trim(),
          layout: roomForm.layout.trim(),
          area: optionalNumber(roomForm.area),
          facilities: toFacilityArray(roomForm.facilities),
          status: roomForm.status
        },
        organizationId: currentOrgId
      });
      Taro.showToast({ title: "房间信息已更新", icon: "success" });
      resetRoomWork();
      await loadApartments();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "更新房间失败", icon: "none" });
    }
  };

  const deleteRoom = async (room: Room) => {
    if (!currentOrgId) return;
    if (!canManageRoom) { Taro.showToast({ title: "当前角色没有管理房间权限", icon: "none" }); return; }
    if (room.status === "OCCUPIED") { Taro.showToast({ title: "已租房间不能删除，请先退租", icon: "none" }); return; }
    try {
      await apiClient(`/apartments/rooms/${room.id}`, { method: "DELETE", organizationId: currentOrgId });
      Taro.showToast({ title: "房间已删除", icon: "success" });
      resetRoomWork();
      await loadApartments();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "删除房间失败", icon: "none" });
    }
  };

  const addBatchRooms = async (roomNos: string[]) => {
    if (!currentOrgId || !selectedApartment) return;
    if (!canManageRoom) { Taro.showToast({ title: "当前角色没有管理房间权限", icon: "none" }); return; }
    if (roomNos.length === 0) { Taro.showToast({ title: "请至少选择一个房间号", icon: "none" }); return; }
    try {
      await apiClient(`/apartments/${selectedApartment.id}/rooms/batch`, {
        method: "POST",
        body: {
          rooms: roomNos.map((roomNo) => ({
            roomNo,
            layout: "未配置",
            facilities: []
          }))
        },
        organizationId: currentOrgId
      });
      resetRoomWork();
      Taro.showToast({ title: `已提交 ${roomNos.length} 间房间，重复房间会自动跳过`, icon: "success" });
      await loadApartments();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "批量添加房间失败", icon: "none" });
    }
  };

  const openRecordExpense = (apartmentId?: string) => {
    setExpenseApartmentId(apartmentId);
    setLayer("expense");
  };

  const closeExpense = () => {
    setLayer(undefined);
    setExpenseApartmentId(undefined);
  };

  const openRoomSingle = () => {
    setLayer("roomSingle");
  };

  const openRoomBatch = () => {
    setLayer("roomBatch");
  };

  const openRoomEdit = (room: Room) => {
    setDeleteRoomId(undefined);
    setEditingRoomId(room.id);
    setLayer("roomEdit");
  };

  const openRoomDelete = (room: Room) => {
    setEditingRoomId(undefined);
    setDeleteRoomId(room.id);
    setLayer("roomDelete");
  };

  if (!currentOrgId) {
    return <NoOrganization />;
  }

  return (
    <View>
      {mode === "list" && (
        <ApartmentList
          apartments={apartments}
          canManageApartment={canManageApartment}
          onOpenDetail={openDetail}
          onCreate={handleCreate}
          onRecordExpense={openRecordExpense}
        />
      )}

      {(mode === "create" || mode === "edit") && (
        <ApartmentForm
          mode={mode}
          form={form}
          saving={saving}
          onUpdateForm={updateForm}
          onBack={mode === "create" ? backToList : () => setMode("detail")}
          onSave={saveApartment}
        />
      )}

      {mode === "detail" && selectedApartment && (
        <ApartmentDetail
          selectedApartment={selectedApartment}
          apartmentRooms={apartmentRooms}
          detailTab={detailTab}
          canManageApartment={canManageApartment}
          canManageRoom={canManageRoom}
          editingRoomId={editingRoomId}
          deleteRoomId={deleteRoomId}
          onBack={backToList}
          onEdit={() => setMode("edit")}
          onDeleteApartment={() => setLayer("apartmentDelete")}
          onChangeTab={(tab) => {
            if (tab === "expenses") {
              resetRoomWork();
            } else {
              setLayer(undefined);
              setExpenseApartmentId(undefined);
            }
            setDetailTab(tab);
          }}
          onRecordExpense={() => openRecordExpense()}
          onOpenRoomSingle={openRoomSingle}
          onOpenRoomBatch={openRoomBatch}
          onOpenRoomEdit={openRoomEdit}
          onOpenRoomDelete={openRoomDelete}
        />
      )}

      <ExpenseSheet
        visible={layer === "expense"}
        onSave={addExpense}
        onClose={closeExpense}
      />

      <RoomSingleSheet
        visible={layer === "roomSingle"}
        onSave={createRoom}
        onClose={resetRoomWork}
      />

      <RoomBatchSheet
        visible={layer === "roomBatch"}
        onSave={addBatchRooms}
        onClose={resetRoomWork}
      />

      <RoomEditSheet
        visible={layer === "roomEdit"}
        room={editingRoom}
        onSave={updateRoom}
        onClose={resetRoomWork}
      />

      <DeleteConfirmSheet
        visible={layer === "roomDelete" && !!deletingRoom}
        title="删除房间"
        description="删除后房间资料不可恢复，请确认当前房间没有有效租约。"
        onConfirm={() => deletingRoom && deleteRoom(deletingRoom)}
        onClose={resetRoomWork}
      />

      <DeleteConfirmSheet
        visible={layer === "apartmentDelete"}
        title="删除公寓"
        description="删除后公寓及下属所有房间资料不可恢复，请确认当前公寓没有有效租约。"
        onConfirm={deleteApartment}
        onClose={() => setLayer(undefined)}
      />
    </View>
  );
}
