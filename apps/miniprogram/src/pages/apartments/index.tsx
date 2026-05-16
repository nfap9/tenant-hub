import { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { useAppSession, useHasPermission } from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { Button, Card, EmptyState, Badge, Input, DateField, FacilitySelector } from '../../components/ui';
import { NoOrganization } from '../../components/NoOrganization';
import { TaskSheet } from '../../components/TaskSheet';
import { money, optionalNumber, optionalText, toFacilityArray, facilitiesText } from '../../utils/format';
import { buildBatchRoomNos, groupBatchRoomNosByFloor, toggleBatchRoomSelection } from '../../utils/batchRooms';
import type { Apartment, Room, RoomStatus } from '../../types/domain';
import './index.scss';

const emptyApartmentForm = {
  name: "",
  location: "",
  floors: "",
  landArea: "",
  totalArea: "",
  landlordName: "",
  landlordPhone: "",
  contractStart: "",
  contractEnd: "",
  rentAmount: "",
  waterUnitPrice: "0",
  powerUnitPrice: "0"
};

const emptyRoomForm = {
  roomNo: "",
  layout: "开间",
  area: "",
  facilities: "",
  status: "VACANT" as RoomStatus
};

const statusLabels: Record<RoomStatus, string> = {
  VACANT: "空闲",
  RESERVED: "预留",
  OCCUPIED: "已租",
  MAINTENANCE: "维修"
};

const toneForStatus: Record<RoomStatus, "success" | "neutral" | "warning" | "danger"> = {
  VACANT: "success",
  RESERVED: "neutral",
  OCCUPIED: "warning",
  MAINTENANCE: "danger"
};

const roomStatuses: RoomStatus[] = ["VACANT", "RESERVED", "OCCUPIED", "MAINTENANCE"];
const roomLayoutOptions = ["开间", "一室一厅", "两室一厅", "两室两厅", "三室一厅", "三室两厅", "四室两厅"];

const isThisMonth = (value?: string) => {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
};

const monthlyAmount = (value: string | number, cycle?: string) => {
  const amount = Number(value ?? 0);
  if (cycle === "QUARTERLY") return amount / 3;
  if (cycle === "YEARLY") return amount / 12;
  return amount;
};

const apartmentMonthlyIncome = (apartment: Apartment) =>
  (apartment.rooms ?? []).reduce((sum, room) => {
    const activeLease = room.leases?.find((lease) => lease.status === "ACTIVE");
    if (!activeLease) return sum;
    const leaseMonthlyRent = monthlyAmount(activeLease.rentAmount, activeLease.cycle);
    const leaseMonthlyFees = (activeLease.fees ?? []).reduce((feeSum, fee) => feeSum + monthlyAmount(fee.amount, activeLease.cycle), 0);
    return sum + leaseMonthlyRent + leaseMonthlyFees;
  }, 0);

const apartmentMonthlyExpense = (apartment: Apartment) =>
  (apartment.expenses ?? []).filter((expense) => isThisMonth(expense.spentAt)).reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);

const contractText = (apartment: Apartment) => {
  const start = apartment.contractStart ? apartment.contractStart.slice(0, 10) : "";
  const end = apartment.contractEnd ? apartment.contractEnd.slice(0, 10) : "";
  if (!start && !end) return "未维护";
  return `${start || "未填"} 至 ${end || "未填"}`;
};

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
  const [roomForm, setRoomForm] = useState(emptyRoomForm);
  const [expense, setExpense] = useState({ name: "", amount: "", spentAt: new Date().toISOString().slice(0, 10), note: "" });
  const [batchStartFloor, setBatchStartFloor] = useState("2");
  const [batchEndFloor, setBatchEndFloor] = useState("4");
  const [batchRoomCount, setBatchRoomCount] = useState("4");
  const [selectedBatchRoomNos, setSelectedBatchRoomNos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const selectedApartment = useMemo(() => apartments.find((item) => item.id === selectedId), [apartments, selectedId]);
  const apartmentRooms = useMemo(
    () => [...(selectedApartment?.rooms ?? [])].sort((left, right) => left.roomNo.localeCompare(right.roomNo, "zh-Hans-CN")),
    [selectedApartment]
  );
  const editingRoom = useMemo(() => apartmentRooms.find((room) => room.id === editingRoomId), [apartmentRooms, editingRoomId]);
  const deletingRoom = useMemo(() => apartmentRooms.find((room) => room.id === deleteRoomId), [apartmentRooms, deleteRoomId]);
  const expenseApartment = useMemo(() => apartments.find((item) => item.id === expenseApartmentId) ?? selectedApartment, [apartments, expenseApartmentId, selectedApartment]);
  const generatedBatchRoomNos = useMemo(
    () => buildBatchRoomNos({ startFloor: batchStartFloor, endFloor: batchEndFloor, roomCount: batchRoomCount }),
    [batchStartFloor, batchEndFloor, batchRoomCount]
  );
  const selectedGeneratedBatchRoomNos = useMemo(
    () => generatedBatchRoomNos.filter((roomNo) => selectedBatchRoomNos.includes(roomNo)),
    [generatedBatchRoomNos, selectedBatchRoomNos]
  );
  const batchRoomGroups = useMemo(() => groupBatchRoomNosByFloor(generatedBatchRoomNos), [generatedBatchRoomNos]);

  useEffect(() => {
    setSelectedBatchRoomNos(generatedBatchRoomNos);
  }, [generatedBatchRoomNos]);

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
  const updateRoomForm = (key: keyof typeof roomForm, value: string | RoomStatus) => setRoomForm((old) => ({ ...old, [key]: value }));

  const resetRoomWork = () => {
    setLayer(undefined);
    setEditingRoomId(undefined);
    setDeleteRoomId(undefined);
    setRoomForm(emptyRoomForm);
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

  const saveApartment = async () => {
    if (!currentOrgId) return Taro.showToast({ title: "请先选择组织", icon: "none" });
    if (!canManageApartment) return Taro.showToast({ title: "当前角色没有管理公寓权限", icon: "none" });
    if (!form.name.trim() || !form.location.trim()) return Taro.showToast({ title: "请填写公寓名称和位置", icon: "none" });
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
        rentAmount: optionalNumber(form.rentAmount),
        waterUnitPrice: Number(form.waterUnitPrice || 0),
        powerUnitPrice: Number(form.powerUnitPrice || 0)
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
    if (!canManageApartment) return Taro.showToast({ title: "当前角色没有管理公寓权限", icon: "none" });
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

  const addExpense = async () => {
    const apartmentId = expenseApartmentId ?? selectedApartment?.id;
    if (!currentOrgId || !apartmentId) return;
    if (!canManageApartment) return Taro.showToast({ title: "当前角色没有管理公寓权限", icon: "none" });
    if (!expense.name.trim() || !expense.amount.trim()) return Taro.showToast({ title: "请填写花费名称和金额", icon: "none" });
    try {
      await apiClient(`/apartments/${apartmentId}/expenses`, {
        method: "POST",
        body: { name: expense.name.trim(), amount: Number(expense.amount), spentAt: expense.spentAt, note: optionalText(expense.note) },
        organizationId: currentOrgId
      });
      setExpense({ name: "", amount: "", spentAt: new Date().toISOString().slice(0, 10), note: "" });
      setLayer(undefined);
      setExpenseApartmentId(undefined);
      Taro.showToast({ title: "经营花费已记录", icon: "success" });
      await loadApartments();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "记录花费失败", icon: "none" });
    }
  };

  const createRoom = async () => {
    if (!currentOrgId || !selectedApartment) return;
    if (!canManageRoom) return Taro.showToast({ title: "当前角色没有管理房间权限", icon: "none" });
    if (!roomForm.roomNo.trim() || !roomForm.layout.trim()) return Taro.showToast({ title: "请填写房间号和户型", icon: "none" });
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

  const updateRoom = async () => {
    if (!currentOrgId || !editingRoomId) return;
    if (!canManageRoom) return Taro.showToast({ title: "当前角色没有管理房间权限", icon: "none" });
    if (!roomForm.roomNo.trim() || !roomForm.layout.trim()) return Taro.showToast({ title: "请填写房间号和户型", icon: "none" });
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
    if (!canManageRoom) return Taro.showToast({ title: "当前角色没有管理房间权限", icon: "none" });
    if (room.status === "OCCUPIED") return Taro.showToast({ title: "已租房间不能删除，请先退租", icon: "none" });
    try {
      await apiClient(`/apartments/rooms/${room.id}`, { method: "DELETE", organizationId: currentOrgId });
      Taro.showToast({ title: "房间已删除", icon: "success" });
      resetRoomWork();
      await loadApartments();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "删除房间失败", icon: "none" });
    }
  };

  const addBatchRooms = async () => {
    if (!currentOrgId || !selectedApartment) return;
    if (!canManageRoom) return Taro.showToast({ title: "当前角色没有管理房间权限", icon: "none" });
    if (generatedBatchRoomNos.length === 0) return Taro.showToast({ title: "请输入有效的楼层范围和房间数量", icon: "none" });
    if (selectedGeneratedBatchRoomNos.length === 0) return Taro.showToast({ title: "请至少选择一个房间号", icon: "none" });
    try {
      await apiClient(`/apartments/${selectedApartment.id}/rooms/batch`, {
        method: "POST",
        body: {
          rooms: selectedGeneratedBatchRoomNos.map((roomNo) => ({
            roomNo,
            layout: "未配置",
            facilities: []
          }))
        },
        organizationId: currentOrgId
      });
      resetRoomWork();
      Taro.showToast({ title: `已提交 ${selectedGeneratedBatchRoomNos.length} 间房间，重复房间会自动跳过`, icon: "success" });
      await loadApartments();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "批量添加房间失败", icon: "none" });
    }
  };

  if (!currentOrgId) {
    return <NoOrganization />;
  }

  // ========== LIST MODE ==========
  if (mode === "list") {
    return (
      <View className="page-container">
        <Card
          title="公寓列表"
          headerAction={canManageApartment ? <Button variant="secondary" size="small" onClick={() => { setSelectedId(undefined); setForm(emptyApartmentForm); setMode("create"); }}>新建</Button> : undefined}
        >
          {apartments.length === 0 ? (
            <EmptyState icon="apartment" title="暂无公寓" subtitle="点击新建开始维护" action={<Button onClick={() => { setSelectedId(undefined); setForm(emptyApartmentForm); setMode("create"); }}>新建公寓</Button>} />
          ) : null}
          {apartments.map((item) => {
            const rooms = item.rooms ?? [];
            const occupied = rooms.filter((room) => room.status === "OCCUPIED").length;
            const monthlyIncome = apartmentMonthlyIncome(item);
            const monthlyExpense = apartmentMonthlyExpense(item);
            return (
              <View key={item.id} className="apartment-card" onClick={() => openDetail(item.id)}>
                <View className="apartment-card-header">
                  <View>
                    <Text className="card-title">{item.name}</Text>
                    <Text className="text-muted">{item.location}</Text>
                  </View>
                  <Text className="card-stat">{occupied}/{rooms.length} 间在租</Text>
                </View>
                <View className="detail-row">
                  <Text className="text-muted">{item.floors} 层 · 总面积 {item.totalArea ?? "未填"}㎡</Text>
                  <Text className="text-muted">水 {money(item.waterUnitPrice)} / 电 {money(item.powerUnitPrice)}</Text>
                </View>
                <View className="detail-row">
                  <Text className="card-stat">本月收入 ¥{money(monthlyIncome)}</Text>
                  <Text className="text-muted">本月花费 ¥{money(monthlyExpense)}</Text>
                </View>
                {canManageApartment ? (
                  <View onClick={(e) => { e.stopPropagation(); setExpenseApartmentId(item.id); setLayer("expense"); }}>
                    <Button variant="ghost" size="small">记录花费</Button>
                  </View>
                ) : null}
              </View>
            );
          })}
        </Card>

        <TaskSheet
          visible={layer === "expense"}
          title="记录花费"
          onClose={() => { setLayer(undefined); setExpenseApartmentId(undefined); }}
          footer={(
            <>
              <Button onClick={addExpense}>保存花费</Button>
              <Button variant="ghost" onClick={() => { setLayer(undefined); setExpenseApartmentId(undefined); }}>取消</Button>
            </>
          )}
        >
              <View className="form-grid">
                <Input label="花费名称" placeholder="例如 维修材料" value={expense.name} onChange={(value) => setExpense((old) => ({ ...old, name: value }))} />
                <Input label="金额" placeholder="请输入金额" type="number" value={expense.amount} onChange={(value) => setExpense((old) => ({ ...old, amount: value }))} />
                <DateField label="日期" placeholder="选择日期" value={expense.spentAt} onChange={(value) => setExpense((old) => ({ ...old, spentAt: value }))} />
              </View>
              <Input label="备注" placeholder="可选" value={expense.note} onChange={(value) => setExpense((old) => ({ ...old, note: value }))} />
        </TaskSheet>
      </View>
    );
  }

  // ========== CREATE / EDIT MODE ==========
  if (mode === "create" || mode === "edit") {
    return (
      <View className="page-container">
        <View className="sub-page-header">
          <Button className="page-back-button" variant="ghost" size="small" onClick={mode === "create" ? backToList : () => setMode("detail")}>
            {mode === "create" ? "‹ 返回公寓列表" : "‹ 返回公寓详情"}
          </Button>
        </View>
        <Card title={mode === "create" ? "新建公寓" : "编辑公寓信息"}>
          <Input label="公寓名称" placeholder="例如 阳光公寓" value={form.name} onChange={(value) => updateForm("name", value)} />
          <Input label="位置" placeholder="请输入地址或片区" value={form.location} onChange={(value) => updateForm("location", value)} />
          <View className="form-grid">
            <Input label="楼层数" placeholder="例如 6" type="number" value={form.floors} onChange={(value) => updateForm("floors", value)} />
            <Input label="占地面积" placeholder="平方米" type="number" value={form.landArea} onChange={(value) => updateForm("landArea", value)} />
            <Input label="总面积" placeholder="平方米" type="number" value={form.totalArea} onChange={(value) => updateForm("totalArea", value)} />
          </View>
          <Text className="section-label">上游信息</Text>
          <Input label="房东姓名" placeholder="请输入房东姓名" value={form.landlordName} onChange={(value) => updateForm("landlordName", value)} />
          <Input label="联系方式" placeholder="请输入手机号" value={form.landlordPhone} onChange={(value) => updateForm("landlordPhone", value)} />
          <View className="form-grid">
            <DateField label="合同开始日期" placeholder="选择日期" value={form.contractStart} onChange={(value) => updateForm("contractStart", value)} />
            <DateField label="合同结束日期" placeholder="选择日期" value={form.contractEnd} onChange={(value) => updateForm("contractEnd", value)} />
            <Input label="上游租金" placeholder="每期金额" type="number" value={form.rentAmount} onChange={(value) => updateForm("rentAmount", value)} />
          </View>
          <Text className="section-label">水电单价</Text>
          <View className="form-grid">
            <Input label="水费单价" placeholder="元/吨" type="number" value={form.waterUnitPrice} onChange={(value) => updateForm("waterUnitPrice", value)} />
            <Input label="电费单价" placeholder="元/度" type="number" value={form.powerUnitPrice} onChange={(value) => updateForm("powerUnitPrice", value)} />
          </View>
          <Button loading={saving} disabled={saving} onClick={saveApartment}>
            {mode === "create" ? "创建公寓" : "保存公寓信息"}
          </Button>
        </Card>
      </View>
    );
  }

  // ========== DETAIL MODE ==========
  if (mode === "detail" && selectedApartment) {
    const apartmentVacantRooms = apartmentRooms.filter((room) => room.status === "VACANT").length;
    const apartmentOccupiedRooms = apartmentRooms.filter((room) => room.status === "OCCUPIED").length;

    return (
      <View className="page-container">
        <View className="sub-page-header">
          <Button className="page-back-button" variant="ghost" size="small" onClick={backToList}>‹ 返回公寓列表</Button>
        </View>

        <Card
          title={selectedApartment.name}
          subtitle={selectedApartment.location}
          headerAction={canManageApartment ? (
            <View className="action-row-inline">
              <Button variant="secondary" size="small" onClick={() => setMode("edit")}>编辑</Button>
              <Button variant="danger" size="small" onClick={() => setLayer("apartmentDelete")}>删除</Button>
            </View>
          ) : undefined}
        >
          <View className="segment">
            <View className={`segment-item ${detailTab === "expenses" ? "segment-item--active" : ""}`} onClick={() => { resetRoomWork(); setDetailTab("expenses"); }}>
              <Text className={`segment-text ${detailTab === "expenses" ? "segment-text--active" : ""}`}>公寓详情</Text>
            </View>
            <View className={`segment-item ${detailTab === "rooms" ? "segment-item--active" : ""}`} onClick={() => { setLayer(undefined); setExpenseApartmentId(undefined); setDetailTab("rooms"); }}>
              <Text className={`segment-text ${detailTab === "rooms" ? "segment-text--active" : ""}`}>房间列表</Text>
            </View>
          </View>
        </Card>

        {detailTab === "expenses" ? (
          <>
            <Card>
              <View className="detail-panel">
                <View className="detail-row">
                  <Text className="text-muted">楼层/面积</Text>
                  <Text className="card-title">{selectedApartment.floors} 层 · 占地 {selectedApartment.landArea ?? "未填"}㎡ · 总 {selectedApartment.totalArea ?? "未填"}㎡</Text>
                </View>
                <View className="detail-row">
                  <Text className="text-muted">上游房东</Text>
                  <Text className="card-title">{selectedApartment.landlordName || "未维护"} · {selectedApartment.landlordPhone || "未维护"}</Text>
                </View>
                <View className="detail-row">
                  <Text className="text-muted">合同期</Text>
                  <Text className="text-muted">{contractText(selectedApartment)}</Text>
                </View>
                <View className="detail-row">
                  <Text className="text-muted">上游租金</Text>
                  <Text className="card-stat">¥{money(selectedApartment.rentAmount)}</Text>
                </View>
                <View className="detail-row">
                  <Text className="text-muted">水电单价</Text>
                  <Text className="text-muted">水 ¥{money(selectedApartment.waterUnitPrice)} · 电 ¥{money(selectedApartment.powerUnitPrice)}</Text>
                </View>
                <View className="detail-row">
                  <Text className="text-muted">房间数量</Text>
                  <Text className="card-stat">{selectedApartment.rooms?.length ?? 0} 间</Text>
                </View>
              </View>
            </Card>

            <Card
              title="经营花费"
              subtitle="每月经营支出从这里快速记录"
              headerAction={canManageApartment ? <Button variant="secondary" size="small" onClick={() => { setExpenseApartmentId(selectedApartment.id); setLayer("expense"); }}>记录花费</Button> : undefined}
            >
              {(selectedApartment.expenses ?? []).slice(0, 4).map((item) => (
                <View className="detail-row" key={item.id}>
                  <Text className="text-muted">{item.name} · {item.spentAt.slice(0, 10)}</Text>
                  <Text className="card-stat">¥{money(item.amount)}</Text>
                </View>
              ))}
              {(selectedApartment.expenses ?? []).length === 0 ? <Text className="text-muted">暂无经营花费记录</Text> : null}
            </Card>
          </>
        ) : null}

        {detailTab === "rooms" ? (
          <Card
            title="房间列表"
            subtitle={`共 ${apartmentRooms.length} 间 · 空闲 ${apartmentVacantRooms} 间 · 已租 ${apartmentOccupiedRooms} 间`}
            headerAction={canManageRoom ? (
              <View className="action-row-inline">
                <Button variant="secondary" size="small" onClick={() => { setRoomForm(emptyRoomForm); setEditingRoomId(undefined); setDeleteRoomId(undefined); setLayer("roomSingle"); }}>新增房间</Button>
                <Button variant="secondary" size="small" onClick={() => { setRoomForm(emptyRoomForm); setEditingRoomId(undefined); setDeleteRoomId(undefined); setSelectedBatchRoomNos(buildBatchRoomNos({ startFloor: batchStartFloor, endFloor: batchEndFloor, roomCount: batchRoomCount })); setLayer("roomBatch"); }}>批量添加</Button>
              </View>
            ) : undefined}
          >
            {apartmentRooms.map((room) => (
              <View key={room.id} className={`room-card ${(editingRoomId === room.id || deleteRoomId === room.id) ? 'room-card--active' : ''}`}>
                <View className="room-card-header">
                  <View>
                    <Text className="card-title">{room.roomNo}</Text>
                    <Text className="text-muted">{room.layout} · {room.area ?? "未填"}㎡</Text>
                  </View>
                  <Badge tone={toneForStatus[room.status]}>{statusLabels[room.status]}</Badge>
                </View>
                <Text className="text-muted">{facilitiesText(room.facilities)}</Text>
                {canManageRoom ? (
                  <View className="action-row-inline">
                    <Button variant="secondary" size="small" onClick={() => {
                      setRoomForm({ roomNo: room.roomNo, layout: room.layout, area: room.area ? String(room.area) : "", facilities: room.facilities?.join(",") ?? "", status: room.status });
                      setDeleteRoomId(undefined);
                      setEditingRoomId(room.id);
                      setLayer("roomEdit");
                    }}>编辑</Button>
                    <Button variant="danger" size="small" disabled={room.status === "OCCUPIED"} onClick={() => { setEditingRoomId(undefined); setDeleteRoomId(room.id); setLayer("roomDelete"); }}>删除</Button>
                  </View>
                ) : null}
              </View>
            ))}
            {apartmentRooms.length === 0 ? <Text className="text-muted">暂无房间，可以新增单个房间或批量添加</Text> : null}
          </Card>
        ) : null}

        <TaskSheet
          visible={layer === "expense"}
          title="记录花费"
          onClose={() => { setLayer(undefined); setExpenseApartmentId(undefined); }}
          footer={(
            <>
              <Button onClick={addExpense}>保存花费</Button>
              <Button variant="ghost" onClick={() => { setLayer(undefined); setExpenseApartmentId(undefined); }}>取消</Button>
            </>
          )}
        >
              <View className="form-grid">
                <Input label="花费名称" placeholder="例如 维修材料" value={expense.name} onChange={(value) => setExpense((old) => ({ ...old, name: value }))} />
                <Input label="金额" placeholder="请输入金额" type="number" value={expense.amount} onChange={(value) => setExpense((old) => ({ ...old, amount: value }))} />
                <DateField label="日期" placeholder="选择日期" value={expense.spentAt} onChange={(value) => setExpense((old) => ({ ...old, spentAt: value }))} />
              </View>
              <Input label="备注" placeholder="可选" value={expense.note} onChange={(value) => setExpense((old) => ({ ...old, note: value }))} />
        </TaskSheet>

        <TaskSheet
          visible={layer === "roomSingle"}
          title="新增房间"
          onClose={resetRoomWork}
          footer={(
            <>
              <Button onClick={createRoom}>保存房间</Button>
              <Button variant="ghost" onClick={resetRoomWork}>取消</Button>
            </>
          )}
        >
              <View className="form-grid">
                <Input label="房间号" placeholder="例如 301" value={roomForm.roomNo} onChange={(value) => updateRoomForm("roomNo", value)} />
                <Input label="面积" placeholder="平方米" type="number" value={roomForm.area} onChange={(value) => updateRoomForm("area", value)} />
              </View>
              <Text className="field-label">户型</Text>
              <View className="layout-selector">
                {roomLayoutOptions.map((layout) => (
                  <Button key={layout} variant={roomForm.layout === layout ? "primary" : "ghost"} size="small" onClick={() => updateRoomForm("layout", layout)}>{layout}</Button>
                ))}
              </View>
              <FacilitySelector value={roomForm.facilities} onChange={(value) => updateRoomForm("facilities", value)} />
        </TaskSheet>

        <TaskSheet
          visible={layer === "roomBatch"}
          title="批量添加房间"
          onClose={resetRoomWork}
          footer={(
            <>
              <Button onClick={addBatchRooms}>确认添加房间</Button>
              <Button variant="ghost" onClick={resetRoomWork}>取消</Button>
            </>
          )}
        >
              <View className="form-grid">
                <Input label="开始楼层" placeholder="例如 2" type="number" value={batchStartFloor} onChange={setBatchStartFloor} />
                <Input label="结束楼层" placeholder="例如 4" type="number" value={batchEndFloor} onChange={setBatchEndFloor} />
                <Input label="每层房间数" placeholder="例如 4" type="number" value={batchRoomCount} onChange={setBatchRoomCount} />
              </View>
              <View className="batch-room-panel">
                <View className="detail-row">
                  <Text className="field-label">生成房间号</Text>
                  <Text className="text-muted">已选 {selectedGeneratedBatchRoomNos.length}/{generatedBatchRoomNos.length}</Text>
                </View>
                {generatedBatchRoomNos.length > 0 ? (
                  <View className="batch-room-groups">
                    {batchRoomGroups.map((group) => (
                      <View key={group.floor} className="batch-room-row">
                        <Text className="batch-room-floor">{group.floor}层</Text>
                        <View className="batch-room-grid">
                          {group.roomNos.map((roomNo) => {
                            const selected = selectedBatchRoomNos.includes(roomNo);
                            return (
                              <Button key={roomNo} variant={selected ? "primary" : "ghost"} size="small" onClick={() => setSelectedBatchRoomNos((old) => toggleBatchRoomSelection(old, roomNo))}>
                                {roomNo}
                              </Button>
                            );
                          })}
                        </View>
                      </View>
                    ))}
                  </View>
                ) : <Text className="text-muted">输入有效的楼层范围和每层房间数后会自动生成房间号</Text>}
              </View>
        </TaskSheet>

        <TaskSheet
          visible={layer === "roomEdit"}
          title="编辑房间"
          onClose={resetRoomWork}
          footer={(
            <>
              <Button onClick={updateRoom}>保存修改</Button>
              <Button variant="ghost" onClick={resetRoomWork}>取消</Button>
            </>
          )}
        >
              <View className="form-grid">
                <Input label="房间号" placeholder="例如 301" value={roomForm.roomNo} onChange={(value) => updateRoomForm("roomNo", value)} />
                <Input label="面积" placeholder="平方米" type="number" value={roomForm.area} onChange={(value) => updateRoomForm("area", value)} />
              </View>
              <Text className="field-label">户型</Text>
              <View className="layout-selector">
                {roomLayoutOptions.map((layout) => (
                  <Button key={layout} variant={roomForm.layout === layout ? "primary" : "ghost"} size="small" onClick={() => updateRoomForm("layout", layout)}>{layout}</Button>
                ))}
              </View>
              <FacilitySelector value={roomForm.facilities} onChange={(value) => updateRoomForm("facilities", value)} />
              <Text className="field-label">状态</Text>
              <View className="layout-selector">
                {roomStatuses.map((status) => (
                  <Button key={status} variant={roomForm.status === status ? "primary" : "ghost"} size="small" onClick={() => updateRoomForm("status", status)}>{statusLabels[status]}</Button>
                ))}
              </View>
        </TaskSheet>

        <TaskSheet
          visible={layer === "roomDelete" && !!deletingRoom}
          variant="dialog"
          title="删除房间"
          onClose={resetRoomWork}
          footer={deletingRoom ? (
            <>
              <Button variant="danger" size="small" onClick={() => deleteRoom(deletingRoom)}>确认删除</Button>
              <Button variant="ghost" size="small" onClick={resetRoomWork}>取消</Button>
            </>
          ) : undefined}
        >
          <Text className="text-muted">删除后房间资料不可恢复，请确认当前房间没有有效租约。</Text>
        </TaskSheet>

        <TaskSheet
          visible={layer === "apartmentDelete"}
          variant="dialog"
          title="删除公寓"
          onClose={() => setLayer(undefined)}
          footer={(
            <>
              <Button variant="danger" size="small" onClick={deleteApartment}>确认删除</Button>
              <Button variant="ghost" size="small" onClick={() => setLayer(undefined)}>取消</Button>
            </>
          )}
        >
          <Text className="text-muted">删除后公寓及下属所有房间资料不可恢复，请确认当前公寓没有有效租约。</Text>
        </TaskSheet>
      </View>
    );
  }

  return null;
}
