import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { mobileApi } from "../../services";
import { styles } from "../../theme/styles";
import type { Apartment, ApartmentFeeItem, Room, RoomStatus } from "../../types";

type Props = {
  token: string;
  organizationId?: string;
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
  layout: "",
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

const statusStyles: Record<RoomStatus, object> = {
  VACANT: styles.statusVacant,
  RESERVED: styles.statusReserved,
  OCCUPIED: styles.statusOccupied,
  MAINTENANCE: styles.statusMaintenance
};

const roomStatuses: RoomStatus[] = ["VACANT", "RESERVED", "OCCUPIED", "MAINTENANCE"];

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

export default function ApartmentsScreen({ token, organizationId, setNotice }: Props) {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [mode, setMode] = useState<"list" | "detail" | "edit" | "create">("list");
  const [detailTab, setDetailTab] = useState<"expenses" | "rooms">("expenses");
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [listExpenseApartmentId, setListExpenseApartmentId] = useState<string>();
  const [feeFormOpen, setFeeFormOpen] = useState(false);
  const [roomFormMode, setRoomFormMode] = useState<"single" | "batch">();
  const [editingRoomId, setEditingRoomId] = useState<string>();
  const [deleteRoomId, setDeleteRoomId] = useState<string>();
  const [form, setForm] = useState<ApartmentForm>(emptyApartmentForm);
  const [roomForm, setRoomForm] = useState<RoomForm>(emptyRoomForm);
  const [expense, setExpense] = useState({ name: "", amount: "", spentAt: new Date().toISOString().slice(0, 10), note: "" });
  const [fee, setFee] = useState({ name: "", spec: "", amount: "" });
  const [batchRooms, setBatchRooms] = useState("101,102,103\n201,202,203");
  const [batchLayout, setBatchLayout] = useState("一室一卫");
  const [batchArea, setBatchArea] = useState("");
  const [batchFacilities, setBatchFacilities] = useState("床,衣柜,空调,热水器");
  const [saving, setSaving] = useState(false);

  const selectedApartment = useMemo(() => apartments.find((item) => item.id === selectedId), [apartments, selectedId]);
  const apartmentRooms = useMemo(
    () => [...(selectedApartment?.rooms ?? [])].sort((left, right) => left.roomNo.localeCompare(right.roomNo, "zh-Hans-CN")),
    [selectedApartment]
  );
  const apartmentVacantRooms = apartmentRooms.filter((room) => room.status === "VACANT").length;
  const apartmentOccupiedRooms = apartmentRooms.filter((room) => room.status === "OCCUPIED").length;

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

  const updateForm = (key: keyof ApartmentForm, value: string) => setForm((old) => ({ ...old, [key]: value }));
  const updateRoomForm = (key: keyof RoomForm, value: string | RoomStatus) => setRoomForm((old) => ({ ...old, [key]: value }));

  const resetRoomWork = () => {
    setRoomFormMode(undefined);
    setEditingRoomId(undefined);
    setDeleteRoomId(undefined);
    setRoomForm(emptyRoomForm);
  };

  const startCreateRoom = () => {
    setRoomForm(emptyRoomForm);
    setEditingRoomId(undefined);
    setDeleteRoomId(undefined);
    setRoomFormMode((old) => (old === "single" ? undefined : "single"));
  };

  const startBatchRooms = () => {
    setRoomForm(emptyRoomForm);
    setEditingRoomId(undefined);
    setDeleteRoomId(undefined);
    setRoomFormMode((old) => (old === "batch" ? undefined : "batch"));
  };

  const startEditRoom = (room: Room) => {
    setRoomForm({
      roomNo: room.roomNo,
      layout: room.layout,
      area: room.area ? String(room.area) : "",
      facilities: room.facilities?.join(",") ?? "",
      status: room.status
    });
    setRoomFormMode(undefined);
    setDeleteRoomId(undefined);
    setEditingRoomId((old) => (old === room.id ? undefined : room.id));
  };

  const saveApartment = async () => {
    if (!organizationId) return setNotice("请先选择组织");
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
    setSelectedId(undefined);
    setForm(emptyApartmentForm);
    setMode("create");
  };

  const openDetail = (apartmentId: string) => {
    setSelectedId(apartmentId);
    setExpenseFormOpen(false);
    setListExpenseApartmentId(undefined);
    setFeeFormOpen(false);
    resetRoomWork();
    setDetailTab("expenses");
    setMode("detail");
  };

  const backToList = () => {
    setSelectedId(undefined);
    setExpenseFormOpen(false);
    setListExpenseApartmentId(undefined);
    setFeeFormOpen(false);
    resetRoomWork();
    setDetailTab("expenses");
    setMode("list");
  };

  const addExpense = async (apartmentId = selectedApartment?.id) => {
    if (!organizationId || !apartmentId) return;
    if (!expense.name.trim() || !expense.amount.trim()) return setNotice("请填写花费名称和金额");
    await mobileApi(`/apartments/${apartmentId}/expenses`, token, apiOptions(organizationId, "POST", {
      name: expense.name.trim(),
      amount: Number(expense.amount),
      spentAt: expense.spentAt,
      note: optionalText(expense.note)
    }));
    setExpense({ name: "", amount: "", spentAt: new Date().toISOString().slice(0, 10), note: "" });
    setExpenseFormOpen(false);
    setListExpenseApartmentId(undefined);
    setNotice("经营花费已记录");
    await loadApartments();
  };

  const addFee = async () => {
    if (!organizationId || !selectedApartment) return;
    if (!fee.name.trim() || !fee.amount.trim()) return setNotice("请填写费用名称和金额");
    await mobileApi(`/apartments/${selectedApartment.id}/fees`, token, apiOptions(organizationId, "POST", {
      name: fee.name.trim(),
      spec: optionalText(fee.spec),
      amount: Number(fee.amount),
      enabled: true
    }));
    setFee({ name: "", spec: "", amount: "" });
    setFeeFormOpen(false);
    setNotice("费用项目已添加");
    await loadApartments();
  };

  const toggleFee = async (item: ApartmentFeeItem) => {
    if (!organizationId) return;
    await mobileApi(`/apartments/fees/${item.id}`, token, apiOptions(organizationId, "PUT", { enabled: !item.enabled }));
    await loadApartments();
  };

  const createRoom = async () => {
    if (!organizationId || !selectedApartment) return;
    if (!roomForm.roomNo.trim() || !roomForm.layout.trim()) return setNotice("请填写房间号和户型");
    await mobileApi(`/apartments/${selectedApartment.id}/rooms/batch`, token, apiOptions(organizationId, "POST", {
      rooms: [{
        roomNo: roomForm.roomNo.trim(),
        layout: roomForm.layout.trim(),
        area: optionalNumber(roomForm.area),
        facilities: toFacilityArray(roomForm.facilities)
      }]
    }));
    setNotice("房间已添加");
    resetRoomWork();
    await loadApartments();
  };

  const updateRoom = async () => {
    if (!organizationId || !editingRoomId) return;
    if (!roomForm.roomNo.trim() || !roomForm.layout.trim()) return setNotice("请填写房间号和户型");
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
  };

  const deleteRoom = async (room: Room) => {
    if (!organizationId) return;
    if (room.status === "OCCUPIED") return setNotice("已租房间不能删除，请先退租");
    await mobileApi(`/apartments/rooms/${room.id}`, token, apiOptions(organizationId, "DELETE"));
    setNotice("房间已删除");
    resetRoomWork();
    await loadApartments();
  };

  const addBatchRooms = async () => {
    if (!organizationId || !selectedApartment) return;
    const roomNos = batchRooms.split(/[\n,，\s]+/).map((item) => item.trim()).filter(Boolean);
    if (roomNos.length === 0) return setNotice("请输入房间号");
    const facilities = toFacilityArray(batchFacilities);
    await mobileApi(`/apartments/${selectedApartment.id}/rooms/batch`, token, apiOptions(organizationId, "POST", {
      rooms: roomNos.map((roomNo) => ({
        roomNo,
        layout: batchLayout.trim() || "未配置",
        area: optionalNumber(batchArea),
        facilities
      }))
    }));
    resetRoomWork();
    setNotice(`已提交 ${roomNos.length} 间房间，重复房间会自动跳过`);
    await loadApartments();
  };

  const renderRoomFields = (showStatus = false) => (
    <>
      <View style={styles.formGrid}>
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>房间号</Text>
          <TextInput style={styles.input} placeholder="101" value={roomForm.roomNo} onChangeText={(value) => updateRoomForm("roomNo", value)} />
        </View>
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>户型</Text>
          <TextInput style={styles.input} placeholder="一室一卫" value={roomForm.layout} onChangeText={(value) => updateRoomForm("layout", value)} />
        </View>
        <View style={styles.formField}>
          <Text style={styles.fieldLabel}>面积</Text>
          <TextInput style={styles.input} placeholder="平方米" value={roomForm.area} keyboardType="numeric" onChangeText={(value) => updateRoomForm("area", value)} />
        </View>
      </View>
      <TextInput style={styles.input} placeholder="设施，用逗号分隔" value={roomForm.facilities} onChangeText={(value) => updateRoomForm("facilities", value)} />
      {showStatus ? (
        <View style={styles.roleActions}>
          {roomStatuses.map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.smallButton, roomForm.status === status && styles.smallButtonActive]}
              onPress={() => updateRoomForm("status", status)}
            >
              <Text style={[styles.smallButtonText, roomForm.status === status && styles.smallButtonTextActive]}>{statusLabels[status]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </>
  );

  if (!organizationId) {
    return (
      <View style={styles.panel}>
        <Text style={styles.muted}>请先选择组织</Text>
      </View>
    );
  }

  return (
    <>
      {mode === "list" ? (
        <View style={styles.panel}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>公寓列表</Text>
            <TouchableOpacity style={styles.smallButton} onPress={resetForCreate}>
              <Text style={styles.smallButtonText}>新建</Text>
            </TouchableOpacity>
          </View>
          {apartments.length === 0 ? <Text style={styles.emptyText}>暂无公寓，点击新建开始维护</Text> : null}
          {apartments.map((item) => {
            const rooms = item.rooms ?? [];
            const occupied = rooms.filter((room) => room.status === "OCCUPIED").length;
            const monthlyIncome = apartmentMonthlyIncome(item);
            const monthlyExpense = apartmentMonthlyExpense(item);
            const isRecordingExpense = listExpenseApartmentId === item.id;
            return (
              <View key={item.id} style={styles.apartmentListCard}>
                <TouchableOpacity onPress={() => openDetail(item.id)}>
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
                </TouchableOpacity>
                <View style={styles.detailRow}>
                  <Text style={styles.cardStat}>本月收入 ¥{money(monthlyIncome)}</Text>
                  <Text style={styles.muted}>本月花费 ¥{money(monthlyExpense)}</Text>
                </View>
                <View style={styles.roomActions}>
                  <TouchableOpacity
                    style={[styles.smallButton, isRecordingExpense && styles.smallButtonActive]}
                    onPress={() => {
                      setExpenseFormOpen(false);
                      setListExpenseApartmentId((old) => (old === item.id ? undefined : item.id));
                    }}
                  >
                    <Text style={[styles.smallButtonText, isRecordingExpense && styles.smallButtonTextActive]}>{isRecordingExpense ? "收起" : "记录花费"}</Text>
                  </TouchableOpacity>
                </View>
                {isRecordingExpense ? (
                  <>
                    <View style={styles.formGrid}>
                      <TextInput style={[styles.input, styles.gridInput]} placeholder="花费名称" value={expense.name} onChangeText={(value) => setExpense((old) => ({ ...old, name: value }))} />
                      <TextInput style={[styles.input, styles.gridInput]} placeholder="金额" value={expense.amount} keyboardType="numeric" onChangeText={(value) => setExpense((old) => ({ ...old, amount: value }))} />
                      <TextInput style={[styles.input, styles.gridInput]} placeholder="日期" value={expense.spentAt} onChangeText={(value) => setExpense((old) => ({ ...old, spentAt: value }))} />
                    </View>
                    <TextInput style={styles.input} placeholder="备注" value={expense.note} onChangeText={(value) => setExpense((old) => ({ ...old, note: value }))} />
                    <TouchableOpacity style={styles.secondaryButton} onPress={() => addExpense(item.id)}>
                      <Text style={styles.secondaryButtonText}>保存花费</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {(mode === "edit" || mode === "create") ? (
      <>
        <View style={styles.subPageHeader}>
          <TouchableOpacity style={styles.backButton} onPress={mode === "create" ? backToList : () => setMode("detail")}>
            <Text style={styles.backButtonText}>{mode === "create" ? "返回公寓列表" : "返回公寓详情"}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>{mode === "create" ? "新建公寓" : "编辑公寓信息"}</Text>
          <TextInput style={styles.input} placeholder="公寓名称" value={form.name} onChangeText={(value) => updateForm("name", value)} />
          <TextInput style={styles.input} placeholder="位置" value={form.location} onChangeText={(value) => updateForm("location", value)} />
          <View style={styles.formGrid}>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>楼层数</Text>
              <TextInput style={styles.input} placeholder="例如 6" value={form.floors} keyboardType="numeric" onChangeText={(value) => updateForm("floors", value)} />
            </View>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>占地面积</Text>
              <TextInput style={styles.input} placeholder="平方米" value={form.landArea} keyboardType="numeric" onChangeText={(value) => updateForm("landArea", value)} />
            </View>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>总面积</Text>
              <TextInput style={styles.input} placeholder="平方米" value={form.totalArea} keyboardType="numeric" onChangeText={(value) => updateForm("totalArea", value)} />
            </View>
          </View>
          <Text style={styles.label}>上游信息</Text>
          <TextInput style={styles.input} placeholder="房东姓名" value={form.landlordName} onChangeText={(value) => updateForm("landlordName", value)} />
          <TextInput style={styles.input} placeholder="联系方式" value={form.landlordPhone} onChangeText={(value) => updateForm("landlordPhone", value)} />
          <View style={styles.formGrid}>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>合同开始</Text>
              <TextInput style={styles.input} placeholder="2026-05-01" value={form.contractStart} onChangeText={(value) => updateForm("contractStart", value)} />
            </View>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>合同结束</Text>
              <TextInput style={styles.input} placeholder="2027-04-30" value={form.contractEnd} onChangeText={(value) => updateForm("contractEnd", value)} />
            </View>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>上游租金</Text>
              <TextInput style={styles.input} placeholder="每期金额" value={form.rentAmount} keyboardType="numeric" onChangeText={(value) => updateForm("rentAmount", value)} />
            </View>
          </View>
          <Text style={styles.label}>水电单价</Text>
          <View style={styles.formGrid}>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>水费单价</Text>
              <TextInput style={styles.input} placeholder="元/吨" value={form.waterUnitPrice} keyboardType="numeric" onChangeText={(value) => updateForm("waterUnitPrice", value)} />
            </View>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>电费单价</Text>
              <TextInput style={styles.input} placeholder="元/度" value={form.powerUnitPrice} keyboardType="numeric" onChangeText={(value) => updateForm("powerUnitPrice", value)} />
            </View>
          </View>
          <TouchableOpacity style={[styles.button, saving && styles.buttonDisabled]} disabled={saving} onPress={saveApartment}>
            <Text style={styles.buttonText}>{mode === "create" ? "创建公寓" : "保存公寓信息"}</Text>
          </TouchableOpacity>
        </View>
        {mode === "edit" && selectedApartment ? (
          <View style={styles.panel}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>费用配置</Text>
                <Text style={styles.muted}>签约时可选择的网费、管理费、服务费等项目</Text>
              </View>
              <TouchableOpacity
                style={[styles.smallButton, feeFormOpen && styles.smallButtonActive]}
                onPress={() => setFeeFormOpen((old) => !old)}
              >
                <Text style={[styles.smallButtonText, feeFormOpen && styles.smallButtonTextActive]}>{feeFormOpen ? "收起" : "添加费用项"}</Text>
              </TouchableOpacity>
            </View>
            {feeFormOpen ? (
              <>
                <View style={styles.formGrid}>
                  <TextInput style={[styles.input, styles.gridInput]} placeholder="费用名称" value={fee.name} onChangeText={(value) => setFee((old) => ({ ...old, name: value }))} />
                  <TextInput style={[styles.input, styles.gridInput]} placeholder="规格" value={fee.spec} onChangeText={(value) => setFee((old) => ({ ...old, spec: value }))} />
                  <TextInput style={[styles.input, styles.gridInput]} placeholder="金额" value={fee.amount} keyboardType="numeric" onChangeText={(value) => setFee((old) => ({ ...old, amount: value }))} />
                </View>
                <TouchableOpacity style={styles.secondaryButton} onPress={addFee}>
                  <Text style={styles.secondaryButtonText}>保存费用项</Text>
                </TouchableOpacity>
              </>
            ) : null}
            {(selectedApartment.feeItems ?? []).map((item) => (
              <TouchableOpacity style={[styles.feeItem, item.enabled && styles.feeItemActive]} key={item.id} onPress={() => toggleFee(item)}>
                <Text style={styles.cardTitle}>{item.name}{item.spec ? ` · ${item.spec}` : ""}</Text>
                <Text style={item.enabled ? styles.cardStat : styles.muted}>¥{money(item.amount)} · {item.enabled ? "启用" : "停用"}</Text>
              </TouchableOpacity>
            ))}
            {(selectedApartment.feeItems ?? []).length === 0 ? <Text style={styles.muted}>暂无可选费用项目，点击添加费用项维护</Text> : null}
          </View>
        ) : null}
      </>
      ) : null}

      {mode === "detail" && selectedApartment ? (
        <>
          <View style={styles.subPageHeader}>
            <TouchableOpacity style={styles.backButton} onPress={backToList}>
              <Text style={styles.backButtonText}>返回公寓列表</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.panel}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>{selectedApartment.name}</Text>
                <Text style={styles.muted}>{selectedApartment.location}</Text>
              </View>
              <View style={styles.roomActions}>
                <TouchableOpacity style={styles.smallButton} onPress={() => setMode("edit")}>
                  <Text style={styles.smallButtonText}>编辑</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.segment}>
              <TouchableOpacity
                style={[styles.segmentItem, detailTab === "expenses" && styles.segmentItemActive]}
                onPress={() => {
                  resetRoomWork();
                  setDetailTab("expenses");
                }}
              >
                <Text style={[styles.segmentText, detailTab === "expenses" && styles.segmentTextActive]}>公寓详情</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentItem, detailTab === "rooms" && styles.segmentItemActive]}
                onPress={() => {
                  setExpenseFormOpen(false);
                  setDetailTab("rooms");
                }}
              >
                <Text style={[styles.segmentText, detailTab === "rooms" && styles.segmentTextActive]}>房间列表</Text>
              </TouchableOpacity>
            </View>
          </View>

          {detailTab === "expenses" ? (
            <>
              <View style={styles.panel}>
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
              </View>

          <View style={styles.panel}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>经营花费</Text>
                <Text style={styles.muted}>每月经营支出从这里快速记录</Text>
              </View>
              <TouchableOpacity
                style={[styles.smallButton, expenseFormOpen && styles.smallButtonActive]}
                onPress={() => setExpenseFormOpen((old) => !old)}
              >
                <Text style={[styles.smallButtonText, expenseFormOpen && styles.smallButtonTextActive]}>{expenseFormOpen ? "收起" : "记录花费"}</Text>
              </TouchableOpacity>
            </View>
            {(selectedApartment.expenses ?? []).slice(0, 4).map((item) => (
              <View style={styles.detailRow} key={item.id}>
                <Text style={styles.muted}>{item.name} · {toDateInput(item.spentAt)}</Text>
                <Text style={styles.cardStat}>¥{money(item.amount)}</Text>
              </View>
            ))}
            {(selectedApartment.expenses ?? []).length === 0 ? <Text style={styles.muted}>暂无经营花费记录</Text> : null}
            {expenseFormOpen ? (
              <>
                <View style={styles.formGrid}>
                  <TextInput style={[styles.input, styles.gridInput]} placeholder="花费名称" value={expense.name} onChangeText={(value) => setExpense((old) => ({ ...old, name: value }))} />
                  <TextInput style={[styles.input, styles.gridInput]} placeholder="金额" value={expense.amount} keyboardType="numeric" onChangeText={(value) => setExpense((old) => ({ ...old, amount: value }))} />
                  <TextInput style={[styles.input, styles.gridInput]} placeholder="日期" value={expense.spentAt} onChangeText={(value) => setExpense((old) => ({ ...old, spentAt: value }))} />
                </View>
                <TextInput style={styles.input} placeholder="备注" value={expense.note} onChangeText={(value) => setExpense((old) => ({ ...old, note: value }))} />
                <TouchableOpacity style={styles.secondaryButton} onPress={() => addExpense()}>
                  <Text style={styles.secondaryButtonText}>保存花费</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
            </>
          ) : null}
        </>
      ) : null}

      {mode === "detail" && detailTab === "rooms" && selectedApartment ? (
        <>
          <View style={styles.panel}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>房间列表</Text>
                <Text style={styles.muted}>共 {apartmentRooms.length} 间 · 空闲 {apartmentVacantRooms} 间 · 已租 {apartmentOccupiedRooms} 间</Text>
              </View>
              <View style={styles.roomActions}>
                <TouchableOpacity
                  style={[styles.smallButton, roomFormMode === "single" && styles.smallButtonActive]}
                  onPress={startCreateRoom}
                >
                  <Text style={[styles.smallButtonText, roomFormMode === "single" && styles.smallButtonTextActive]}>{roomFormMode === "single" ? "收起" : "新增房间"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.smallButton, roomFormMode === "batch" && styles.smallButtonActive]}
                  onPress={startBatchRooms}
                >
                  <Text style={[styles.smallButtonText, roomFormMode === "batch" && styles.smallButtonTextActive]}>{roomFormMode === "batch" ? "收起批量" : "批量添加"}</Text>
                </TouchableOpacity>
              </View>
            </View>
            {roomFormMode === "single" ? (
              <>
                <Text style={styles.label}>新增单个房间</Text>
                {renderRoomFields(false)}
                <TouchableOpacity style={styles.button} onPress={createRoom}>
                  <Text style={styles.buttonText}>保存房间</Text>
                </TouchableOpacity>
              </>
            ) : null}
            {roomFormMode === "batch" ? (
              <>
                <Text style={styles.label}>批量添加房间</Text>
                <TextInput style={[styles.input, styles.textarea]} multiline placeholder="房间号，用逗号、空格或换行分隔" value={batchRooms} onChangeText={setBatchRooms} />
                <View style={styles.formGrid}>
                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>户型</Text>
                    <TextInput style={styles.input} placeholder="一室一卫" value={batchLayout} onChangeText={setBatchLayout} />
                  </View>
                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>面积</Text>
                    <TextInput style={styles.input} placeholder="平方米" value={batchArea} keyboardType="numeric" onChangeText={setBatchArea} />
                  </View>
                </View>
                <TextInput style={styles.input} placeholder="设施，用逗号分隔" value={batchFacilities} onChangeText={setBatchFacilities} />
                <TouchableOpacity style={styles.button} onPress={addBatchRooms}>
                  <Text style={styles.buttonText}>确认添加房间</Text>
                </TouchableOpacity>
              </>
            ) : null}

            {apartmentRooms.map((room) => (
              <View style={[styles.apartmentListCard, editingRoomId === room.id && styles.roomCardActive]} key={room.id}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.cardTitle}>{room.roomNo}</Text>
                    <Text style={styles.muted}>{room.layout} · {room.area ?? "未填"}㎡</Text>
                  </View>
                  <Text style={[styles.statusBadge, statusStyles[room.status]]}>{statusLabels[room.status]}</Text>
                </View>
                <Text style={styles.muted}>{facilitiesText(room.facilities)}</Text>
                <View style={styles.roomActions}>
                  <TouchableOpacity style={styles.smallButton} onPress={() => startEditRoom(room)}>
                    <Text style={styles.smallButtonText}>{editingRoomId === room.id ? "收起" : "编辑"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={room.status === "OCCUPIED" ? [styles.smallDangerButton, styles.buttonDisabled] : styles.smallDangerButton}
                    disabled={room.status === "OCCUPIED"}
                    onPress={() => {
                      setEditingRoomId(undefined);
                      setRoomFormMode(undefined);
                      setDeleteRoomId((old) => (old === room.id ? undefined : room.id));
                    }}
                  >
                    <Text style={styles.smallDangerText}>删除</Text>
                  </TouchableOpacity>
                </View>
                {editingRoomId === room.id ? (
                  <>
                    {renderRoomFields(true)}
                    <TouchableOpacity style={styles.secondaryButton} onPress={updateRoom}>
                      <Text style={styles.secondaryButtonText}>保存修改</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
                {deleteRoomId === room.id ? (
                  <View style={styles.detailPanel}>
                    <Text style={styles.muted}>删除后房间资料不可恢复，请确认当前房间没有有效租约。</Text>
                    <View style={styles.roomActions}>
                      <TouchableOpacity style={styles.smallDangerButton} onPress={() => deleteRoom(room)}>
                        <Text style={styles.smallDangerText}>确认删除</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.smallButton} onPress={() => setDeleteRoomId(undefined)}>
                        <Text style={styles.smallButtonText}>取消</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
              </View>
            ))}
            {apartmentRooms.length === 0 ? <Text style={styles.muted}>暂无房间，可以新增单个房间或批量添加</Text> : null}
          </View>
        </>
      ) : null}
    </>
  );
}
