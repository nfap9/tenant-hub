import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { mobileApi } from "../../services";
import { styles } from "../../theme/styles";
import type { ApartmentFeeItem, RentCycle, Room, RoomStatus } from "../../types";

type Props = {
  token: string;
  organizationId?: string;
  setNotice: (notice: string) => void;
};

type RoomForm = {
  roomNo: string;
  layout: string;
  area: string;
  facilities: string;
  status: RoomStatus;
};

type LeaseForm = {
  tenantName: string;
  tenantPhone: string;
  startDate: string;
  endDate: string;
  cycle: RentCycle;
  rentAmount: string;
  depositAmount: string;
  waterUnitPrice: string;
  powerUnitPrice: string;
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

const filters: Array<RoomStatus | "ALL"> = ["ALL", "VACANT", "OCCUPIED", "RESERVED", "MAINTENANCE"];
const today = () => new Date().toISOString().slice(0, 10);
const nextYear = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
};
const apiOptions = (organizationId: string, method = "GET", body?: unknown): RequestInit => ({
  method,
  headers: { "x-organization-id": organizationId },
  ...(body ? { body: JSON.stringify(body) } : {})
});
const money = (value?: string | number) => Number(value ?? 0).toFixed(2);

export default function RoomsScreen({ token, organizationId, setNotice }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [filter, setFilter] = useState<RoomStatus | "ALL">("ALL");
  const [selectedId, setSelectedId] = useState<string>();
  const [activeRoomForm, setActiveRoomForm] = useState<"edit">();
  const [leaseRoomId, setLeaseRoomId] = useState<string>();
  const [roomForm, setRoomForm] = useState<RoomForm>({ roomNo: "", layout: "", area: "", facilities: "", status: "VACANT" });
  const [leaseForm, setLeaseForm] = useState<LeaseForm>({
    tenantName: "",
    tenantPhone: "",
    startDate: today(),
    endDate: nextYear(),
    cycle: "MONTHLY",
    rentAmount: "",
    depositAmount: "",
    waterUnitPrice: "0",
    powerUnitPrice: "0"
  });
  const [selectedFeeIds, setSelectedFeeIds] = useState<string[]>([]);

  const selectedRoom = useMemo(() => rooms.find((item) => item.id === selectedId), [rooms, selectedId]);
  const leaseRoom = useMemo(() => rooms.find((item) => item.id === leaseRoomId), [rooms, leaseRoomId]);
  const activeLease = selectedRoom?.leases?.find((item) => item.status === "ACTIVE");
  const visibleRooms = useMemo(() => (filter === "ALL" ? rooms : rooms.filter((item) => item.status === filter)), [filter, rooms]);
  const vacantCount = rooms.filter((item) => item.status === "VACANT").length;
  const occupiedCount = rooms.filter((item) => item.status === "OCCUPIED").length;

  const loadRooms = useCallback(async () => {
    if (!organizationId) return;
    const data = await mobileApi<Room[]>("/apartments/rooms", token, apiOptions(organizationId));
    setRooms(data);
    setSelectedId((old) => (old && data.some((item) => item.id === old) ? old : undefined));
  }, [organizationId, token]);

  useEffect(() => {
    loadRooms().catch((error) => setNotice(error.message));
  }, [loadRooms, setNotice]);

  useEffect(() => {
    if (!selectedRoom) return;
    setRoomForm({
      roomNo: selectedRoom.roomNo,
      layout: selectedRoom.layout,
      area: selectedRoom.area ? String(selectedRoom.area) : "",
      facilities: selectedRoom.facilities.join(","),
      status: selectedRoom.status
    });
    setLeaseForm((old) => ({
      ...old,
      waterUnitPrice: String(selectedRoom.apartment?.waterUnitPrice ?? 0),
      powerUnitPrice: String(selectedRoom.apartment?.powerUnitPrice ?? 0)
    }));
    setSelectedFeeIds([]);
  }, [selectedRoom]);

  const updateRoom = async () => {
    if (!organizationId || !selectedRoom) return;
    await mobileApi(`/apartments/rooms/${selectedRoom.id}`, token, apiOptions(organizationId, "PUT", {
      roomNo: roomForm.roomNo.trim(),
      layout: roomForm.layout.trim(),
      area: roomForm.area.trim() ? Number(roomForm.area) : undefined,
      facilities: roomForm.facilities.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
      status: roomForm.status
    }));
    setNotice("房间信息已更新");
    setActiveRoomForm(undefined);
    await loadRooms();
  };

  const deleteRoom = async () => {
    if (!organizationId || !selectedRoom) return;
    if (selectedRoom.status === "OCCUPIED") return setNotice("已租房间不能删除，请先退租");
    await mobileApi(`/apartments/rooms/${selectedRoom.id}`, token, apiOptions(organizationId, "DELETE"));
    setNotice("房间已删除");
    setSelectedId(undefined);
    setActiveRoomForm(undefined);
    await loadRooms();
  };

  const createLease = async () => {
    if (!organizationId || !selectedRoom) return;
    if (selectedRoom.status !== "VACANT") return setNotice("仅空闲房间可以签约");
    if (!leaseForm.tenantName.trim() || !leaseForm.tenantPhone.trim() || !leaseForm.rentAmount.trim()) {
      return setNotice("请填写租客、电话和租金");
    }
    const feeItems = selectedRoom.apartment?.feeItems ?? [];
    const fees = feeItems
      .filter((item) => selectedFeeIds.includes(item.id))
      .map((item) => ({ feeItemId: item.id, name: item.spec ? `${item.name} ${item.spec}` : item.name, amount: Number(item.amount) }));
    await mobileApi("/leases", token, apiOptions(organizationId, "POST", {
      roomId: selectedRoom.id,
      tenantName: leaseForm.tenantName.trim(),
      tenantPhone: leaseForm.tenantPhone.trim(),
      startDate: leaseForm.startDate,
      endDate: leaseForm.endDate,
      cycle: leaseForm.cycle,
      rentAmount: Number(leaseForm.rentAmount),
      depositAmount: Number(leaseForm.depositAmount || 0),
      waterUnitPrice: Number(leaseForm.waterUnitPrice || 0),
      powerUnitPrice: Number(leaseForm.powerUnitPrice || 0),
      fees
    }));
    setNotice("签约完成，水电单价和费用项已带入租约");
    setLeaseForm((old) => ({ ...old, tenantName: "", tenantPhone: "", rentAmount: "", depositAmount: "" }));
    setActiveRoomForm(undefined);
    setLeaseRoomId(undefined);
    await loadRooms();
  };

  const terminateLease = async () => {
    if (!organizationId || !activeLease) return;
    await mobileApi(`/leases/${activeLease.id}/terminate`, token, apiOptions(organizationId, "POST", {
      type: "NEGOTIATED",
      reason: "移动端退租",
      terminatedAt: today()
    }));
    setNotice("退租完成，房间已转为空闲");
    await loadRooms();
  };

  const toggleFee = (item: ApartmentFeeItem) => {
    setSelectedFeeIds((old) => (old.includes(item.id) ? old.filter((id) => id !== item.id) : [...old, item.id]));
  };

  if (!organizationId) {
    return (
      <View style={styles.panel}>
        <Text style={styles.muted}>请先选择组织</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.statRow}>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>全部房间</Text>
          <Text style={styles.statValue}>{rooms.length}</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>空闲</Text>
          <Text style={styles.statValue}>{vacantCount}</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>已租</Text>
          <Text style={styles.statValue}>{occupiedCount}</Text>
        </View>
      </View>

      <View style={styles.filterBar}>
        {filters.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.filterButton, filter === item && styles.filterButtonActive]}
            onPress={() => {
              setFilter(item);
              setSelectedId(undefined);
              setActiveRoomForm(undefined);
              setLeaseRoomId(undefined);
            }}
          >
            <Text style={[styles.filterButtonText, filter === item && styles.filterButtonTextActive]}>
              {item === "ALL" ? "全部" : statusLabels[item]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {visibleRooms.length === 0 ? <Text style={styles.emptyText}>暂无房间，请先到公寓页批量添加</Text> : null}

      <View style={styles.roomGrid}>
        {visibleRooms.map((room) => {
          const expanded = selectedId === room.id;
          const roomActiveLease = room.leases?.find((item) => item.status === "ACTIVE");
          return (
            <View key={room.id} style={[styles.roomCard, expanded && styles.roomCardActive]}>
              <TouchableOpacity
                onPress={() => {
                  setSelectedId(expanded ? undefined : room.id);
                  setActiveRoomForm(undefined);
                }}
              >
                <View style={styles.roomHeader}>
                  <View>
                    <Text style={styles.cardTitle}>{room.apartment?.name} · {room.roomNo}</Text>
                    <Text style={styles.muted}>{room.layout} · {room.area ? `${room.area}㎡` : "未填面积"}</Text>
                  </View>
                  <Text style={[styles.statusBadge, statusStyles[room.status]]}>{statusLabels[room.status]}</Text>
                </View>
                <Text style={styles.muted}>{room.facilities.length ? room.facilities.join("、") : "暂无设施"}</Text>
              </TouchableOpacity>

              {expanded ? (
                <>
                  <View style={styles.detailPanel}>
                    <View style={styles.detailRow}>
                      <Text style={styles.muted}>设施</Text>
                      <Text style={styles.muted}>{room.facilities.length ? room.facilities.join("、") : "暂无设施"}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.muted}>水电单价</Text>
                      <Text style={styles.muted}>水 ¥{money(room.apartment?.waterUnitPrice)} · 电 ¥{money(room.apartment?.powerUnitPrice)}</Text>
                    </View>
                  </View>
                  <View style={styles.roomActions}>
                    <TouchableOpacity style={[styles.secondaryButton, styles.actionButton]} onPress={() => setActiveRoomForm((old) => (old === "edit" ? undefined : "edit"))}>
                      <Text style={styles.secondaryButtonText}>{activeRoomForm === "edit" ? "收起编辑" : "编辑房间"}</Text>
                    </TouchableOpacity>
                    {room.status === "VACANT" ? (
                      <TouchableOpacity
                        style={[styles.button, styles.actionButton]}
                        onPress={() => {
                          setSelectedId(room.id);
                          setLeaseRoomId(room.id);
                          setActiveRoomForm(undefined);
                        }}
                      >
                        <Text style={styles.buttonText}>签约入住</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity style={[styles.smallDangerButton, styles.actionButton]} onPress={deleteRoom}>
                      <Text style={styles.smallDangerText}>删除房间</Text>
                    </TouchableOpacity>
                  </View>

                  {activeRoomForm === "edit" ? (
                    <View style={styles.detailPanel}>
                      <Text style={styles.sectionTitle}>编辑房间</Text>
                      <TextInput style={styles.input} placeholder="房间号" value={roomForm.roomNo} onChangeText={(value) => setRoomForm((old) => ({ ...old, roomNo: value }))} />
                      <View style={styles.formGrid}>
                        <View style={styles.formField}>
                          <Text style={styles.fieldLabel}>户型</Text>
                          <TextInput style={styles.input} placeholder="例如 一室一卫" value={roomForm.layout} onChangeText={(value) => setRoomForm((old) => ({ ...old, layout: value }))} />
                        </View>
                        <View style={styles.formField}>
                          <Text style={styles.fieldLabel}>面积</Text>
                          <TextInput style={styles.input} placeholder="平方米" value={roomForm.area} keyboardType="numeric" onChangeText={(value) => setRoomForm((old) => ({ ...old, area: value }))} />
                        </View>
                      </View>
                      <TextInput style={styles.input} placeholder="设施，用逗号分隔" value={roomForm.facilities} onChangeText={(value) => setRoomForm((old) => ({ ...old, facilities: value }))} />
                      <View style={styles.segment}>
                        {(Object.keys(statusLabels) as RoomStatus[]).map((item) => (
                          <TouchableOpacity
                            key={item}
                            style={[styles.segmentItem, roomForm.status === item && styles.segmentItemActive]}
                            onPress={() => setRoomForm((old) => ({ ...old, status: item }))}
                          >
                            <Text style={[styles.segmentText, roomForm.status === item && styles.segmentTextActive]}>{statusLabels[item]}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TouchableOpacity style={styles.secondaryButton} onPress={updateRoom}>
                        <Text style={styles.secondaryButtonText}>保存房间信息</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  {room.status === "OCCUPIED" && roomActiveLease ? (
                    <View style={styles.detailPanel}>
                      <Text style={styles.sectionTitle}>在租信息</Text>
                      <View style={styles.detailRow}>
                        <Text style={styles.muted}>租客</Text>
                        <Text style={styles.cardTitle}>{roomActiveLease.tenantName}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.muted}>租金</Text>
                        <Text style={styles.cardStat}>¥{money(roomActiveLease.rentAmount)}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.muted}>合同期</Text>
                        <Text style={styles.muted}>{roomActiveLease.startDate.slice(0, 10)} 至 {roomActiveLease.endDate.slice(0, 10)}</Text>
                      </View>
                      <TouchableOpacity style={styles.smallDangerButton} onPress={terminateLease}>
                        <Text style={styles.smallDangerText}>退租</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </>
              ) : null}
            </View>
          );
        })}
      </View>
      <Modal visible={Boolean(leaseRoom)} transparent animationType="slide" onRequestClose={() => setLeaseRoomId(undefined)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>签约入住</Text>
                  <Text style={styles.muted}>{leaseRoom?.apartment?.name} · {leaseRoom?.roomNo}</Text>
                </View>
                <TouchableOpacity style={styles.smallButton} onPress={() => setLeaseRoomId(undefined)}>
                  <Text style={styles.smallButtonText}>关闭</Text>
                </TouchableOpacity>
              </View>
              <TextInput style={styles.input} placeholder="租客姓名" value={leaseForm.tenantName} onChangeText={(value) => setLeaseForm((old) => ({ ...old, tenantName: value }))} />
              <TextInput style={styles.input} placeholder="租客电话" value={leaseForm.tenantPhone} onChangeText={(value) => setLeaseForm((old) => ({ ...old, tenantPhone: value }))} />
              <View style={styles.formGrid}>
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>开始日期</Text>
                  <TextInput style={styles.input} placeholder="2026-05-01" value={leaseForm.startDate} onChangeText={(value) => setLeaseForm((old) => ({ ...old, startDate: value }))} />
                </View>
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>结束日期</Text>
                  <TextInput style={styles.input} placeholder="2027-04-30" value={leaseForm.endDate} onChangeText={(value) => setLeaseForm((old) => ({ ...old, endDate: value }))} />
                </View>
              </View>
              <View style={styles.formGrid}>
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>租金</Text>
                  <TextInput style={styles.input} placeholder="每期金额" value={leaseForm.rentAmount} keyboardType="numeric" onChangeText={(value) => setLeaseForm((old) => ({ ...old, rentAmount: value }))} />
                </View>
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>押金</Text>
                  <TextInput style={styles.input} placeholder="押金金额" value={leaseForm.depositAmount} keyboardType="numeric" onChangeText={(value) => setLeaseForm((old) => ({ ...old, depositAmount: value }))} />
                </View>
              </View>
              <View style={styles.segment}>
                {(["MONTHLY", "QUARTERLY", "YEARLY"] as RentCycle[]).map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[styles.segmentItem, leaseForm.cycle === item && styles.segmentItemActive]}
                    onPress={() => setLeaseForm((old) => ({ ...old, cycle: item }))}
                  >
                    <Text style={[styles.segmentText, leaseForm.cycle === item && styles.segmentTextActive]}>{item === "MONTHLY" ? "月付" : item === "QUARTERLY" ? "季付" : "年付"}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.formGrid}>
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>水费单价</Text>
                  <TextInput style={styles.input} placeholder="元/吨" value={leaseForm.waterUnitPrice} keyboardType="numeric" onChangeText={(value) => setLeaseForm((old) => ({ ...old, waterUnitPrice: value }))} />
                </View>
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>电费单价</Text>
                  <TextInput style={styles.input} placeholder="元/度" value={leaseForm.powerUnitPrice} keyboardType="numeric" onChangeText={(value) => setLeaseForm((old) => ({ ...old, powerUnitPrice: value }))} />
                </View>
              </View>
              {(leaseRoom?.apartment?.feeItems ?? []).length ? <Text style={styles.label}>选择费用</Text> : null}
              {(leaseRoom?.apartment?.feeItems ?? []).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.feeItem, selectedFeeIds.includes(item.id) && styles.feeItemActive]}
                  onPress={() => toggleFee(item)}
                >
                  <Text style={styles.cardTitle}>{item.name}{item.spec ? ` · ${item.spec}` : ""}</Text>
                  <Text style={styles.cardStat}>¥{money(item.amount)}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.button} onPress={createLease}>
                <Text style={styles.buttonText}>确认签约</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
