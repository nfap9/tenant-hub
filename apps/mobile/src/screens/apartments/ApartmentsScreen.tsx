import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { DateField } from "../../components/DateField";
import { TaskSheet } from "../../components/TaskSheet";
import { Badge, Button, Card, EmptyState, Input } from "../../components/ui";
import { mobileApi } from "../../services";
import { colors } from "../../theme/tokens";
import { styles } from "../../theme/styles";
import type { Apartment, ApartmentFeeItem, Membership, Room, RoomStatus } from "../../types";
import { buildBatchRoomNos, toggleBatchRoomSelection } from "./batchRooms";

type Props = {
  token: string;
  organizationId?: string;
  currentMembership?: Membership;
  setNotice: (notice: string) => void;
};

type ApartmentForm = {
  name: string;
  location: string;
  floors: string;
  landArea: string;
  totalArea: string;
  landlordName: string;
  landlordPhone: string;
  contractStart: string;
  contractEnd: string;
  rentAmount: string;
  waterUnitPrice: string;
  powerUnitPrice: string;
};

type RoomForm = {
  roomNo: string;
  layout: string;
  area: string;
  facilities: string;
  status: RoomStatus;
};

type ApartmentLayer = "expense" | "fee" | "roomSingle" | "roomBatch" | "roomEdit" | "roomDelete";

const emptyApartmentForm: ApartmentForm = {
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

const emptyRoomForm: RoomForm = {
  roomNo: "",
  layout: "单间",
  area: "",
  facilities: "",
  status: "VACANT"
};

const statusLabels: Record<RoomStatus, string> = {
  VACANT: "空闲",
  RESERVED: "预留",
  OCCUPIED: "已租",
  MAINTENANCE: "维修"
};

const toneForStatus: Record<RoomStatus, Parameters<typeof Badge>[0]["tone"]> = {
  VACANT: "success",
  RESERVED: "neutral",
  OCCUPIED: "warning",
  MAINTENANCE: "danger"
};

const roomStatuses: RoomStatus[] = ["VACANT", "RESERVED", "OCCUPIED", "MAINTENANCE"];
const roomLayoutOptions = ["单间", "一房一厅", "两房一厅", "三房一厅", "四房一厅", "五房一厅", "六房一厅"];

const money = (value?: string | number) => Number(value ?? 0).toFixed(2);
const optionalNumber = (value: string) => (value.trim() ? Number(value) : undefined);
const optionalText = (value: string) => (value.trim() ? value.trim() : undefined);
const monthlyAmount = (value: string | number, cycle?: string) => {
  const amount = Number(value ?? 0);
  if (cycle === "QUARTERLY") return amount / 3;
  if (cycle === "YEARLY") return amount / 12;
  return amount;
};
const apiOptions = (organizationId: string, method = "GET", body?: unknown): RequestInit => ({
  method,
  headers: { "x-organization-id": organizationId },
  ...(body ? { body: JSON.stringify(body) } : {})
});

const toDateInput = (value?: string) => (value ? value.slice(0, 10) : "");
const facilitiesText = (facilities?: string[]) => (facilities?.length ? facilities.join("、") : "未维护设施");
const toFacilityArray = (value: string) => value.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
const isThisMonth = (value?: string) => {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
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
  const start = toDateInput(apartment.contractStart);
  const end = toDateInput(apartment.contractEnd);
  if (!start && !end) return "未维护";
  return `${start || "未填"} 至 ${end || "未填"}`;
};

const hasPermission = (membership: Membership | undefined, permission: string) =>
  Boolean(membership?.role.permissions.includes("*") || membership?.role.permissions.includes(permission));

export default function ApartmentsScreen({ token, organizationId, currentMembership, setNotice }: Props) {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [mode, setMode] = useState<"list" | "detail" | "edit" | "create">("list");
  const [detailTab, setDetailTab] = useState<"expenses" | "rooms">("expenses");
  const [activeLayer, setActiveLayer] = useState<ApartmentLayer>();
  const [expenseApartmentId, setExpenseApartmentId] = useState<string>();
  const [editingRoomId, setEditingRoomId] = useState<string>();
  const [deleteRoomId, setDeleteRoomId] = useState<string>();
  const [form, setForm] = useState<ApartmentForm>(emptyApartmentForm);
  const [roomForm, setRoomForm] = useState<RoomForm>(emptyRoomForm);
  const [expense, setExpense] = useState({ name: "", amount: "", spentAt: new Date().toISOString().slice(0, 10), note: "" });
  const [fee, setFee] = useState({ name: "", spec: "", amount: "" });
  const [batchStartFloor, setBatchStartFloor] = useState("2");
  const [batchEndFloor, setBatchEndFloor] = useState("4");
  const [batchRoomCount, setBatchRoomCount] = useState("4");
  const [selectedBatchRoomNos, setSelectedBatchRoomNos] = useState<string[]>([]);
  const [batchLayout, setBatchLayout] = useState("单间");
  const [batchArea, setBatchArea] = useState("");
  const [batchFacilities, setBatchFacilities] = useState("床,衣柜,空调,热水器");
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
  const apartmentVacantRooms = apartmentRooms.filter((room) => room.status === "VACANT").length;
  const apartmentOccupiedRooms = apartmentRooms.filter((room) => room.status === "OCCUPIED").length;
  const canManageApartment = hasPermission(currentMembership, "apartment:manage");
  const canManageRoom = hasPermission(currentMembership, "room:manage");

  const loadApartments = useCallback(async () => {
    if (!organizationId) return;
    const data = await mobileApi<Apartment[]>("/apartments", token, apiOptions(organizationId));
    setApartments(data);
    setSelectedId((old) => (old && data.some((item) => item.id === old) ? old : undefined));
  }, [organizationId, token]);

  useEffect(() => {
    loadApartments().catch((error) => setNotice(error.message));
  }, [loadApartments, setNotice]);

  useEffect(() => {
    if (!selectedApartment) {
      setForm(emptyApartmentForm);
      return;
    }
    setForm({
      name: selectedApartment.name,
      location: selectedApartment.location,
      floors: String(selectedApartment.floors),
      landArea: selectedApartment.landArea ? String(selectedApartment.landArea) : "",
      totalArea: selectedApartment.totalArea ? String(selectedApartment.totalArea) : "",
      landlordName: selectedApartment.landlordName ?? "",
      landlordPhone: selectedApartment.landlordPhone ?? "",
      contractStart: toDateInput(selectedApartment.contractStart),
      contractEnd: toDateInput(selectedApartment.contractEnd),
      rentAmount: selectedApartment.rentAmount ? String(selectedApartment.rentAmount) : "",
      waterUnitPrice: String(selectedApartment.waterUnitPrice ?? 0),
      powerUnitPrice: String(selectedApartment.powerUnitPrice ?? 0)
    });
  }, [selectedApartment]);

  useEffect(() => {
    setSelectedBatchRoomNos(generatedBatchRoomNos);
  }, [generatedBatchRoomNos]);

  const updateForm = (key: keyof ApartmentForm, value: string) => setForm((old) => ({ ...old, [key]: value }));
  const updateRoomForm = (key: keyof RoomForm, value: string | RoomStatus) => setRoomForm((old) => ({ ...old, [key]: value }));

  const resetRoomWork = () => {
    setActiveLayer(undefined);
    setEditingRoomId(undefined);
    setDeleteRoomId(undefined);
    setRoomForm(emptyRoomForm);
  };

  const openExpense = (apartmentId: string) => {
    setExpenseApartmentId(apartmentId);
    setActiveLayer("expense");
  };

  const startCreateRoom = () => {
    setRoomForm(emptyRoomForm);
    setEditingRoomId(undefined);
    setDeleteRoomId(undefined);
    setActiveLayer("roomSingle");
  };

  const startBatchRooms = () => {
    setRoomForm(emptyRoomForm);
    setEditingRoomId(undefined);
    setDeleteRoomId(undefined);
    setSelectedBatchRoomNos(generatedBatchRoomNos);
    setActiveLayer("roomBatch");
  };

  const startEditRoom = (room: Room) => {
    setRoomForm({
      roomNo: room.roomNo,
      layout: room.layout,
      area: room.area ? String(room.area) : "",
      facilities: room.facilities?.join(",") ?? "",
      status: room.status
    });
    setDeleteRoomId(undefined);
    setEditingRoomId(room.id);
    setActiveLayer("roomEdit");
  };

  const saveApartment = async () => {
    if (!organizationId) return setNotice("请先选择组织");
    if (!canManageApartment) return setNotice("当前角色没有管理公寓权限");
    if (!form.name.trim() || !form.location.trim()) return setNotice("请填写公寓名称和位置");
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
      const saved = await mobileApi<Apartment>(path, token, apiOptions(organizationId, method, payload));
      setNotice(selectedApartment ? "公寓信息已更新" : "公寓已创建");
      setSelectedId(saved.id);
      await loadApartments();
      setMode("detail");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const resetForCreate = () => {
    if (!canManageApartment) return setNotice("当前角色没有管理公寓权限");
    setSelectedId(undefined);
    setForm(emptyApartmentForm);
    setMode("create");
  };

  const openDetail = (apartmentId: string) => {
    setSelectedId(apartmentId);
    setActiveLayer(undefined);
    setExpenseApartmentId(undefined);
    resetRoomWork();
    setDetailTab("expenses");
    setMode("detail");
  };

  const backToList = () => {
    setSelectedId(undefined);
    setActiveLayer(undefined);
    setExpenseApartmentId(undefined);
    resetRoomWork();
    setDetailTab("expenses");
    setMode("list");
  };

  const addExpense = async (apartmentId = expenseApartmentId ?? selectedApartment?.id) => {
    if (!organizationId || !apartmentId) return;
    if (!canManageApartment) return setNotice("当前角色没有管理公寓权限");
    if (!expense.name.trim() || !expense.amount.trim()) return setNotice("请填写花费名称和金额");
    try {
      await mobileApi(`/apartments/${apartmentId}/expenses`, token, apiOptions(organizationId, "POST", {
        name: expense.name.trim(),
        amount: Number(expense.amount),
        spentAt: expense.spentAt,
        note: optionalText(expense.note)
      }));
      setExpense({ name: "", amount: "", spentAt: new Date().toISOString().slice(0, 10), note: "" });
      setActiveLayer(undefined);
      setExpenseApartmentId(undefined);
      setNotice("经营花费已记录");
      await loadApartments();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "记录花费失败");
    }
  };

  const addFee = async () => {
    if (!organizationId || !selectedApartment) return;
    if (!canManageApartment) return setNotice("当前角色没有管理公寓权限");
    if (!fee.name.trim() || !fee.amount.trim()) return setNotice("请填写费用名称和金额");
    try {
      await mobileApi(`/apartments/${selectedApartment.id}/fees`, token, apiOptions(organizationId, "POST", {
        name: fee.name.trim(),
        spec: optionalText(fee.spec),
        amount: Number(fee.amount),
        enabled: true
      }));
      setFee({ name: "", spec: "", amount: "" });
      setActiveLayer(undefined);
      setNotice("费用项目已添加");
      await loadApartments();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "添加费用项失败");
    }
  };

  const toggleFee = async (item: ApartmentFeeItem) => {
    if (!organizationId) return;
    if (!canManageApartment) return setNotice("当前角色没有管理公寓权限");
    try {
      await mobileApi(`/apartments/fees/${item.id}`, token, apiOptions(organizationId, "PUT", { enabled: !item.enabled }));
      await loadApartments();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "更新费用项失败");
    }
  };

  const createRoom = async () => {
    if (!organizationId || !selectedApartment) return;
    if (!canManageRoom) return setNotice("当前角色没有管理房间权限");
    if (!roomForm.roomNo.trim() || !roomForm.layout.trim()) return setNotice("请填写房间号和户型");
    try {
      const result = await mobileApi<{ count: number }>(`/apartments/${selectedApartment.id}/rooms/batch`, token, apiOptions(organizationId, "POST", {
        rooms: [{
          roomNo: roomForm.roomNo.trim(),
          layout: roomForm.layout.trim(),
          area: optionalNumber(roomForm.area),
          facilities: toFacilityArray(roomForm.facilities)
        }]
      }));
      setNotice(result.count > 0 ? "房间已添加" : "房间号已存在，未重复创建");
      resetRoomWork();
      await loadApartments();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "添加房间失败");
    }
  };

  const updateRoom = async () => {
    if (!organizationId || !editingRoomId) return;
    if (!canManageRoom) return setNotice("当前角色没有管理房间权限");
    if (!roomForm.roomNo.trim() || !roomForm.layout.trim()) return setNotice("请填写房间号和户型");
    try {
      await mobileApi(`/apartments/rooms/${editingRoomId}`, token, apiOptions(organizationId, "PUT", {
        roomNo: roomForm.roomNo.trim(),
        layout: roomForm.layout.trim(),
        area: optionalNumber(roomForm.area),
        facilities: toFacilityArray(roomForm.facilities),
        status: roomForm.status
      }));
      setNotice("房间信息已更新");
      resetRoomWork();
      await loadApartments();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "更新房间失败");
    }
  };

  const deleteRoom = async (room: Room) => {
    if (!organizationId) return;
    if (!canManageRoom) return setNotice("当前角色没有管理房间权限");
    if (room.status === "OCCUPIED") return setNotice("已租房间不能删除，请先退租");
    try {
      await mobileApi(`/apartments/rooms/${room.id}`, token, apiOptions(organizationId, "DELETE"));
      setNotice("房间已删除");
      resetRoomWork();
      await loadApartments();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "删除房间失败");
    }
  };

  const addBatchRooms = async () => {
    if (!organizationId || !selectedApartment) return;
    if (!canManageRoom) return setNotice("当前角色没有管理房间权限");
    const selectedRoomNos = generatedBatchRoomNos.filter((roomNo) => selectedBatchRoomNos.includes(roomNo));
    if (generatedBatchRoomNos.length === 0) return setNotice("请输入有效的楼层范围和房间数量");
    if (selectedRoomNos.length === 0) return setNotice("请至少选择一个房间号");
    const facilities = toFacilityArray(batchFacilities);
    try {
      await mobileApi(`/apartments/${selectedApartment.id}/rooms/batch`, token, apiOptions(organizationId, "POST", {
        rooms: selectedRoomNos.map((roomNo) => ({
          roomNo,
          layout: batchLayout.trim() || "未配置",
          area: optionalNumber(batchArea),
          facilities
        }))
      }));
      resetRoomWork();
      setNotice(`已提交 ${selectedRoomNos.length} 间房间，重复房间会自动跳过`);
      await loadApartments();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "批量添加房间失败");
    }
  };

  const startDeleteRoom = (room: Room) => {
    setEditingRoomId(undefined);
    setDeleteRoomId(room.id);
    setActiveLayer("roomDelete");
  };

  const renderLayoutSelector = (value: string, onChange: (layout: string) => void) => {
    const choices = value && !roomLayoutOptions.includes(value) ? [value, ...roomLayoutOptions] : roomLayoutOptions;
    return (
      <View style={styles.roleActions}>
        {choices.map((layout) => (
          <Button
            key={layout}
            variant={value === layout ? "primary" : "ghost"}
            size="small"
            onPress={() => onChange(layout)}
          >
            {layout}
          </Button>
        ))}
      </View>
    );
  };

  const renderRoomFields = (showStatus = false) => (
    <>
      <View style={styles.formGrid}>
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>房间号</Text>
          <Input placeholder="101" value={roomForm.roomNo} onChangeText={(value) => updateRoomForm("roomNo", value)} />
        </View>
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>面积</Text>
          <Input placeholder="平方米" value={roomForm.area} keyboardType="numeric" onChangeText={(value) => updateRoomForm("area", value)} />
        </View>
      </View>
      <View style={styles.formField}>
        <Text style={styles.fieldLabel}>户型</Text>
        {renderLayoutSelector(roomForm.layout, (layout) => updateRoomForm("layout", layout))}
      </View>
      <Input placeholder="设施，用逗号分隔" value={roomForm.facilities} onChangeText={(value) => updateRoomForm("facilities", value)} />
      {showStatus ? (
        <View style={styles.roleActions}>
          {roomStatuses.map((status) => (
            <Button
              key={status}
              variant={roomForm.status === status ? "primary" : "ghost"}
              size="small"
              onPress={() => updateRoomForm("status", status)}
            >
              {statusLabels[status]}
            </Button>
          ))}
        </View>
      ) : null}
    </>
  );

  if (!organizationId) {
    return (
      <Card>
        <EmptyState icon="🏢" title="尚未选择组织" subtitle="请先从右上角用户菜单中选择一个组织" />
      </Card>
    );
  }

  return (
    <>
      {mode === "list" ? (
        <Card
          title="公寓列表"
          headerAction={canManageApartment ? <Button variant="secondary" size="small" onPress={resetForCreate} icon="add-circle-outline">新建</Button> : undefined}
        >
          {apartments.length === 0 ? <EmptyState icon="🏢" title="暂无公寓" subtitle="点击新建开始维护" actionLabel="新建公寓" onAction={resetForCreate} /> : null}
          {apartments.map((item) => {
            const rooms = item.rooms ?? [];
            const occupied = rooms.filter((room) => room.status === "OCCUPIED").length;
            const monthlyIncome = apartmentMonthlyIncome(item);
            const monthlyExpense = apartmentMonthlyExpense(item);
            return (
              <Card key={item.id} variant="outline" padding="md" gap={10} onPress={() => openDetail(item.id)}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.muted}>{item.location}</Text>
                  </View>
                  <Text style={styles.cardStat}>{occupied}/{rooms.length} 间在租</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.muted}>{item.floors} 层 · 总面积 {item.totalArea ?? "未填"}㎡</Text>
                  <Text style={styles.muted}>水 {money(item.waterUnitPrice)} / 电 {money(item.powerUnitPrice)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.cardStat}>本月收入 ¥{money(monthlyIncome)}</Text>
                  <Text style={styles.muted}>本月花费 ¥{money(monthlyExpense)}</Text>
                </View>
                {canManageApartment ? (
                  <Button variant="ghost" size="small" onPress={() => openExpense(item.id)} icon="create-outline">记录花费</Button>
                ) : null}
              </Card>
            );
          })}
        </Card>
      ) : null}

      {(mode === "edit" || mode === "create") ? (
        <>
          <View style={styles.subPageHeader}>
            <Button variant="ghost" size="small" onPress={mode === "create" ? backToList : () => setMode("detail")} icon="arrow-back-outline">
              {mode === "create" ? "返回公寓列表" : "返回公寓详情"}
            </Button>
          </View>
          <Card title={mode === "create" ? "新建公寓" : "编辑公寓信息"}>
            <Input placeholder="公寓名称" value={form.name} onChangeText={(value) => updateForm("name", value)} />
            <Input placeholder="位置" value={form.location} onChangeText={(value) => updateForm("location", value)} />
            <View style={styles.formGrid}>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>楼层数</Text>
                <Input placeholder="例如 6" value={form.floors} keyboardType="numeric" onChangeText={(value) => updateForm("floors", value)} />
              </View>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>占地面积</Text>
                <Input placeholder="平方米" value={form.landArea} keyboardType="numeric" onChangeText={(value) => updateForm("landArea", value)} />
              </View>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>总面积</Text>
                <Input placeholder="平方米" value={form.totalArea} keyboardType="numeric" onChangeText={(value) => updateForm("totalArea", value)} />
              </View>
            </View>
            <Text style={styles.label}>上游信息</Text>
            <Input placeholder="房东姓名" value={form.landlordName} onChangeText={(value) => updateForm("landlordName", value)} />
            <Input placeholder="联系方式" value={form.landlordPhone} onChangeText={(value) => updateForm("landlordPhone", value)} />
            <View style={styles.formGrid}>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>合同开始</Text>
                <DateField value={form.contractStart} onChange={(value) => updateForm("contractStart", value)} />
              </View>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>合同结束</Text>
                <DateField value={form.contractEnd} onChange={(value) => updateForm("contractEnd", value)} />
              </View>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>上游租金</Text>
                <Input placeholder="每期金额" value={form.rentAmount} keyboardType="numeric" onChangeText={(value) => updateForm("rentAmount", value)} />
              </View>
            </View>
            <Text style={styles.label}>水电单价</Text>
            <View style={styles.formGrid}>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>水费单价</Text>
                <Input placeholder="元/吨" value={form.waterUnitPrice} keyboardType="numeric" onChangeText={(value) => updateForm("waterUnitPrice", value)} />
              </View>
              <View style={styles.formField}>
                <Text style={styles.fieldLabel}>电费单价</Text>
                <Input placeholder="元/度" value={form.powerUnitPrice} keyboardType="numeric" onChangeText={(value) => updateForm("powerUnitPrice", value)} />
              </View>
            </View>
            <Button loading={saving} disabled={saving} onPress={saveApartment} icon="save-outline">
              {mode === "create" ? "创建公寓" : "保存公寓信息"}
            </Button>
          </Card>
          {mode === "edit" && selectedApartment ? (
            <Card
              title="费用配置"
              subtitle="签约时可选择的网费、管理费、服务费等项目"
              headerAction={canManageApartment ? <Button variant="secondary" size="small" onPress={() => setActiveLayer("fee")} icon="add-circle-outline">添加费用项</Button> : undefined}
            >
              {(selectedApartment.feeItems ?? []).map((item) => (
                <Card key={item.id} variant={item.enabled ? "default" : "outline"} padding="sm" gap={8} onPress={() => toggleFee(item)}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={styles.cardTitle}>{item.name}{item.spec ? ` · ${item.spec}` : ""}</Text>
                    <Text style={item.enabled ? styles.cardStat : styles.muted}>¥{money(item.amount)} · {item.enabled ? "启用" : "停用"}</Text>
                  </View>
                </Card>
              ))}
              {(selectedApartment.feeItems ?? []).length === 0 ? <Text style={styles.muted}>暂无可选费用项目，点击添加费用项维护</Text> : null}
            </Card>
          ) : null}
        </>
      ) : null}

      {mode === "detail" && selectedApartment ? (
        <>
          <View style={styles.subPageHeader}>
            <Button variant="ghost" size="small" onPress={backToList} icon="arrow-back-outline">返回公寓列表</Button>
          </View>

          <Card
            title={selectedApartment.name}
            subtitle={selectedApartment.location}
            headerAction={canManageApartment ? <Button variant="secondary" size="small" onPress={() => setMode("edit")} icon="create-outline">编辑</Button> : undefined}
          >
            <View style={styles.segment}>
              <View style={[styles.segmentItem, detailTab === "expenses" && styles.segmentItemActive]}>
                <Text style={[styles.segmentText, detailTab === "expenses" && styles.segmentTextActive]} onPress={() => { resetRoomWork(); setDetailTab("expenses"); }}>公寓详情</Text>
              </View>
              <View style={[styles.segmentItem, detailTab === "rooms" && styles.segmentItemActive]}>
                <Text style={[styles.segmentText, detailTab === "rooms" && styles.segmentTextActive]} onPress={() => { setActiveLayer(undefined); setExpenseApartmentId(undefined); setDetailTab("rooms"); }}>房间列表</Text>
              </View>
            </View>
          </Card>

          {detailTab === "expenses" ? (
            <>
              <Card>
                <View style={styles.detailPanel}>
                  <View style={styles.detailRow}>
                    <Text style={styles.muted}>楼层/面积</Text>
                    <Text style={styles.cardTitle}>{selectedApartment.floors} 层 · 占地 {selectedApartment.landArea ?? "未填"}㎡ · 总 {selectedApartment.totalArea ?? "未填"}㎡</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.muted}>上游房东</Text>
                    <Text style={styles.cardTitle}>{selectedApartment.landlordName || "未维护"} · {selectedApartment.landlordPhone || "未维护"}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.muted}>合同期</Text>
                    <Text style={styles.muted}>{contractText(selectedApartment)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.muted}>上游租金</Text>
                    <Text style={styles.cardStat}>¥{money(selectedApartment.rentAmount)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.muted}>水电单价</Text>
                    <Text style={styles.muted}>水 ¥{money(selectedApartment.waterUnitPrice)} · 电 ¥{money(selectedApartment.powerUnitPrice)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.muted}>房间数量</Text>
                    <Text style={styles.cardStat}>{selectedApartment.rooms?.length ?? 0} 间</Text>
                  </View>
                </View>
              </Card>

              <Card
                title="经营花费"
                subtitle="每月经营支出从这里快速记录"
                headerAction={canManageApartment ? <Button variant="secondary" size="small" onPress={() => openExpense(selectedApartment.id)} icon="create-outline">记录花费</Button> : undefined}
              >
                {(selectedApartment.expenses ?? []).slice(0, 4).map((item) => (
                  <View style={styles.detailRow} key={item.id}>
                    <Text style={styles.muted}>{item.name} · {toDateInput(item.spentAt)}</Text>
                    <Text style={styles.cardStat}>¥{money(item.amount)}</Text>
                  </View>
                ))}
                {(selectedApartment.expenses ?? []).length === 0 ? <Text style={styles.muted}>暂无经营花费记录</Text> : null}
              </Card>
            </>
          ) : null}
        </>
      ) : null}

      {mode === "detail" && detailTab === "rooms" && selectedApartment ? (
        <>
          <Card
            title="房间列表"
            subtitle={`共 ${apartmentRooms.length} 间 · 空闲 ${apartmentVacantRooms} 间 · 已租 ${apartmentOccupiedRooms} 间`}
            headerAction={canManageRoom ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button variant="secondary" size="small" onPress={startCreateRoom} icon="add-circle-outline">新增房间</Button>
                <Button variant="secondary" size="small" onPress={startBatchRooms} icon="layers-outline">批量添加</Button>
              </View>
            ) : undefined}
          >
            {apartmentRooms.map((room) => (
              <Card
                key={room.id}
                variant={(editingRoomId === room.id || deleteRoomId === room.id) ? "default" : "outline"}
                padding="md"
                gap={10}
                style={(editingRoomId === room.id || deleteRoomId === room.id) ? { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.primaryLightest } : undefined}
              >
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.cardTitle}>{room.roomNo}</Text>
                    <Text style={styles.muted}>{room.layout} · {room.area ?? "未填"}㎡</Text>
                  </View>
                  <Badge tone={toneForStatus[room.status]}>{statusLabels[room.status]}</Badge>
                </View>
                <Text style={styles.muted}>{facilitiesText(room.facilities)}</Text>
                {canManageRoom ? (
                  <View style={styles.roomActions}>
                    <Button variant="secondary" size="small" onPress={() => startEditRoom(room)} icon="create-outline">编辑</Button>
                    <Button
                      variant="danger"
                      size="small"
                      disabled={room.status === "OCCUPIED"}
                      onPress={() => startDeleteRoom(room)}
                      icon="trash-outline"
                    >
                      删除
                    </Button>
                  </View>
                ) : null}
              </Card>
            ))}
            {apartmentRooms.length === 0 ? <Text style={styles.muted}>暂无房间，可以新增单个房间或批量添加</Text> : null}
          </Card>
        </>
      ) : null}

      <TaskSheet
        visible={activeLayer === "expense"}
        variant="drawer"
        title="记录花费"
        subtitle={expenseApartment ? `${expenseApartment.name} · 经营支出` : "经营支出"}
        onClose={() => {
          setActiveLayer(undefined);
          setExpenseApartmentId(undefined);
        }}
        footer={(
          <Button onPress={() => addExpense()} icon="save-outline">保存花费</Button>
        )}
      >
        <View style={styles.formGrid}>
          <Input style={{ flexGrow: 1, flexBasis: 104 }} placeholder="花费名称" value={expense.name} onChangeText={(value) => setExpense((old) => ({ ...old, name: value }))} />
          <Input style={{ flexGrow: 1, flexBasis: 104 }} placeholder="金额" value={expense.amount} keyboardType="numeric" onChangeText={(value) => setExpense((old) => ({ ...old, amount: value }))} />
          <DateField style={{ flexGrow: 1, flexBasis: 104 }} value={expense.spentAt} onChange={(value) => setExpense((old) => ({ ...old, spentAt: value }))} />
        </View>
        <Input placeholder="备注" value={expense.note} onChangeText={(value) => setExpense((old) => ({ ...old, note: value }))} />
      </TaskSheet>

      <TaskSheet
        visible={activeLayer === "fee"}
        variant="drawer"
        title="添加费用项"
        subtitle={selectedApartment ? `${selectedApartment.name} · 签约可选费用` : undefined}
        onClose={() => setActiveLayer(undefined)}
        footer={(
          <Button onPress={addFee} icon="save-outline">保存费用项</Button>
        )}
      >
        <View style={styles.formGrid}>
          <Input style={{ flexGrow: 1, flexBasis: 104 }} placeholder="费用名称" value={fee.name} onChangeText={(value) => setFee((old) => ({ ...old, name: value }))} />
          <Input style={{ flexGrow: 1, flexBasis: 104 }} placeholder="规格" value={fee.spec} onChangeText={(value) => setFee((old) => ({ ...old, spec: value }))} />
          <Input style={{ flexGrow: 1, flexBasis: 104 }} placeholder="金额" value={fee.amount} keyboardType="numeric" onChangeText={(value) => setFee((old) => ({ ...old, amount: value }))} />
        </View>
      </TaskSheet>

      <TaskSheet
        visible={activeLayer === "roomSingle"}
        variant="drawer"
        title="新增房间"
        subtitle={selectedApartment ? selectedApartment.name : undefined}
        onClose={resetRoomWork}
        footer={(
          <Button onPress={createRoom} icon="save-outline">保存房间</Button>
        )}
      >
        {renderRoomFields(false)}
      </TaskSheet>

      <TaskSheet
        visible={activeLayer === "roomBatch"}
        variant="drawer"
        title="批量添加房间"
        subtitle={selectedApartment ? selectedApartment.name : undefined}
        onClose={resetRoomWork}
        footer={(
          <Button onPress={addBatchRooms} icon="checkmark-outline">确认添加房间</Button>
        )}
      >
        <View style={styles.formGrid}>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>开始楼层</Text>
            <Input placeholder="2" value={batchStartFloor} keyboardType="numeric" onChangeText={setBatchStartFloor} />
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>结束楼层</Text>
            <Input placeholder="4" value={batchEndFloor} keyboardType="numeric" onChangeText={setBatchEndFloor} />
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>每层房间数</Text>
            <Input placeholder="4" value={batchRoomCount} keyboardType="numeric" onChangeText={setBatchRoomCount} />
          </View>
        </View>
        <View style={styles.batchRoomPanel}>
          <View style={styles.detailRow}>
            <Text style={styles.fieldLabel}>生成房间号</Text>
            <Text style={styles.muted}>已选 {selectedBatchRoomNos.length}/{generatedBatchRoomNos.length}</Text>
          </View>
          {generatedBatchRoomNos.length > 0 ? (
            <View style={styles.batchRoomGrid}>
              {generatedBatchRoomNos.map((roomNo) => {
                const selected = selectedBatchRoomNos.includes(roomNo);
                return (
                  <Button
                    key={roomNo}
                    variant={selected ? "primary" : "ghost"}
                    size="small"
                    onPress={() => setSelectedBatchRoomNos((old) => toggleBatchRoomSelection(old, roomNo))}
                  >
                    {roomNo}
                  </Button>
                );
              })}
            </View>
          ) : (
            <Text style={styles.muted}>输入有效的楼层范围和每层房间数后会自动生成房间号</Text>
          )}
        </View>
        <View style={styles.formGrid}>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>户型</Text>
            {renderLayoutSelector(batchLayout, setBatchLayout)}
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>面积</Text>
            <Input placeholder="平方米" value={batchArea} keyboardType="numeric" onChangeText={setBatchArea} />
          </View>
        </View>
        <Input placeholder="设施，用逗号分隔" value={batchFacilities} onChangeText={setBatchFacilities} />
      </TaskSheet>

      <TaskSheet
        visible={activeLayer === "roomEdit"}
        variant="drawer"
        title="编辑房间"
        subtitle={editingRoom ? `${editingRoom.roomNo} · ${editingRoom.layout}` : undefined}
        onClose={resetRoomWork}
        footer={(
          <Button onPress={updateRoom} icon="save-outline">保存修改</Button>
        )}
      >
        {renderRoomFields(true)}
      </TaskSheet>

      <TaskSheet
        visible={activeLayer === "roomDelete"}
        variant="dialog"
        title="删除房间"
        subtitle={deletingRoom ? `${deletingRoom.roomNo} · ${deletingRoom.layout}` : undefined}
        onClose={resetRoomWork}
        footer={deletingRoom ? (
          <View style={styles.roomActions}>
            <Button variant="danger" size="small" onPress={() => deleteRoom(deletingRoom)} icon="trash-outline">确认删除</Button>
            <Button variant="ghost" size="small" onPress={resetRoomWork} icon="close-outline">取消</Button>
          </View>
        ) : null}
      >
        <Text style={styles.muted}>删除后房间资料不可恢复，请确认当前房间没有有效租约。</Text>
      </TaskSheet>
    </>
  );
}
