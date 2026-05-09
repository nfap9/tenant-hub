import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { DateField } from "../../components/DateField";
import { TaskSheet } from "../../components/TaskSheet";
import { Badge, Button, Card, EmptyState, Input, PressableScale } from "../../components/ui";
import type { RoomActionKey } from "../../navigation/homeQuickActions";
import { mobileApi } from "../../services";
import { colors } from "../../theme/tokens";
import { styles } from "../../theme/styles";
import type { BillItemType, Lease, LeaseSettlement, Membership, RentCycle, Room, RoomStatus, TerminationType } from "../../types";
import { getLeaseCandidateRooms } from "./leaseCandidates";
import { getRoomBillGeneratedLabel } from "./roomBillLabel";

type Props = {
  token: string;
  organizationId?: string;
  currentMembership?: Membership;
  setNotice: (notice: string) => void;
  initialAction?: RoomActionKey;
  actionRequestKey?: number;
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
  graceDays: string;
  cycle: RentCycle;
  rentAmount: string;
  depositAmount: string;
  waterUnitPrice: string;
  powerUnitPrice: string;
  autoRenew: boolean;
  generateHistoricalBills: boolean;
};

type TerminationForm = {
  type: TerminationType;
  terminatedAt: string;
  reason: string;
  depositDeductionAmount: string;
  depositDeductionReason: string;
  rentAdjustmentAmount: string;
  currentWater: string;
  currentPower: string;
  otherFeeAmount: string;
  otherFeeReason: string;
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

const filters: Array<RoomStatus | "ALL"> = ["ALL", "VACANT", "OCCUPIED", "RESERVED", "MAINTENANCE"];
const cycleLabels: Record<RentCycle, string> = { MONTHLY: "月付", QUARTERLY: "季付", YEARLY: "年付" };
const presetFeeTypes: Array<{ type: BillItemType; label: string }> = [
  { type: "MANAGEMENT", label: "管理费" },
  { type: "SANITATION", label: "卫生费" },
  { type: "ELEVATOR", label: "电梯费" },
  { type: "PROPERTY", label: "物业费" },
  { type: "NETWORK", label: "网费" }
];
const terminationLabels: Record<TerminationType, string> = { EXPIRED: "到期解约", NEGOTIATED: "协商解约", BREACH: "违约退租" };
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
const numberValue = (value: string) => Number(value || 0);
const defaultTerminationType = (lease: Lease): TerminationType => (today() > lease.endDate.slice(0, 10) ? "EXPIRED" : "NEGOTIATED");
const hasPermission = (membership: Membership | undefined, permission: string) =>
  Boolean(membership?.role.permissions.includes("*") || membership?.role.permissions.includes(permission));

export default function RoomsScreen({ token, organizationId, currentMembership, setNotice, initialAction, actionRequestKey = 0 }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [quickLeaseSelecting, setQuickLeaseSelecting] = useState(false);
  const [filter, setFilter] = useState<RoomStatus | "ALL">("ALL");
  const [selectedId, setSelectedId] = useState<string>();
  const [editingRoomId, setEditingRoomId] = useState<string>();
  const [leaseRoomId, setLeaseRoomId] = useState<string>();
  const [roomForm, setRoomForm] = useState<RoomForm>({ roomNo: "", layout: "", area: "", facilities: "", status: "VACANT" });
  const [leaseForm, setLeaseForm] = useState<LeaseForm>({
    tenantName: "",
    tenantPhone: "",
    startDate: today(),
    endDate: nextYear(),
    graceDays: "0",
    cycle: "MONTHLY",
    rentAmount: "",
    depositAmount: "",
    waterUnitPrice: "0",
    powerUnitPrice: "0",
    autoRenew: true,
    generateHistoricalBills: false
  });
  const [presetFees, setPresetFees] = useState<Array<{ type: BillItemType; amount: string }>>([]);
  const [customFees, setCustomFees] = useState<Array<{ id: string; name: string; amount: string }>>([]);
  const [terminatingLease, setTerminatingLease] = useState<Lease>();
  const [previousReadings, setPreviousReadings] = useState({ previousWater: 0, previousPower: 0 });
  const [terminationForm, setTerminationForm] = useState<TerminationForm>({
    type: "NEGOTIATED",
    terminatedAt: today(),
    reason: "",
    depositDeductionAmount: "0",
    depositDeductionReason: "",
    rentAdjustmentAmount: "0",
    currentWater: "0",
    currentPower: "0",
    otherFeeAmount: "0",
    otherFeeReason: ""
  });

  const selectedRoom = useMemo(() => rooms.find((item) => item.id === selectedId), [rooms, selectedId]);
  const editingRoom = useMemo(() => rooms.find((item) => item.id === editingRoomId), [rooms, editingRoomId]);
  const leaseRoom = useMemo(() => rooms.find((item) => item.id === leaseRoomId), [rooms, leaseRoomId]);
  const visibleRooms = useMemo(() => (filter === "ALL" ? rooms : rooms.filter((item) => item.status === filter)), [filter, rooms]);
  const leaseCandidateRooms = useMemo(() => getLeaseCandidateRooms(rooms), [rooms]);
  const vacantCount = rooms.filter((item) => item.status === "VACANT").length;
  const occupiedCount = rooms.filter((item) => item.status === "OCCUPIED").length;
  const canManageRoom = hasPermission(currentMembership, "room:manage");
  const canManageLease = hasPermission(currentMembership, "lease:manage");
  const settlementPreview = useMemo(() => {
    if (!terminatingLease) return { utility: 0, depositRefund: 0, receivable: 0, refundable: 0, net: 0 };
    const deposit = Number(terminatingLease.depositAmount ?? 0);
    const depositDeduction = numberValue(terminationForm.depositDeductionAmount);
    const rentAdjustment = numberValue(terminationForm.rentAdjustmentAmount);
    const water = Math.max(numberValue(terminationForm.currentWater) - previousReadings.previousWater, 0) * Number(terminatingLease.waterUnitPrice ?? 0);
    const power = Math.max(numberValue(terminationForm.currentPower) - previousReadings.previousPower, 0) * Number(terminatingLease.powerUnitPrice ?? 0);
    const utility = water + power;
    const otherFee = numberValue(terminationForm.otherFeeAmount);
    const depositRefund = Math.max(deposit - depositDeduction, 0);
    const receivable = Math.max(rentAdjustment, 0) + utility + otherFee + depositDeduction;
    const refundable = depositRefund + Math.max(-rentAdjustment, 0);
    return { utility, depositRefund, receivable, refundable, net: receivable - refundable };
  }, [previousReadings, terminatingLease, terminationForm]);

  const loadRooms = useCallback(async () => {
    if (!organizationId) return;
    setLoaded(false);
    const data = await mobileApi<Room[]>("/apartments/rooms", token, apiOptions(organizationId));
    setRooms(data);
    setSelectedId((old) => (old && data.some((item) => item.id === old) ? old : undefined));
    setLoaded(true);
  }, [organizationId, token]);

  useEffect(() => {
    loadRooms().catch((error) => setNotice(error.message));
  }, [loadRooms, setNotice]);

  useEffect(() => {
    if (initialAction !== "lease") {
      setQuickLeaseSelecting(false);
      return;
    }
    if (!loaded) return;
    if (!canManageLease) {
      setQuickLeaseSelecting(false);
      setNotice("当前角色没有管理租约权限");
      return;
    }
    setQuickLeaseSelecting(true);
    setSelectedId(undefined);
    setLeaseRoomId(undefined);
    setEditingRoomId(undefined);
  }, [actionRequestKey, canManageLease, initialAction, loaded, setNotice]);

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
    setPresetFees([]);
    setCustomFees([]);
  }, [selectedRoom]);

  const updateRoom = async () => {
    if (!organizationId || !editingRoom) return;
    if (!canManageRoom) return setNotice("当前角色没有管理房间权限");
    try {
      await mobileApi(`/apartments/rooms/${editingRoom.id}`, token, apiOptions(organizationId, "PUT", {
        roomNo: roomForm.roomNo.trim(),
        layout: roomForm.layout.trim(),
        area: roomForm.area.trim() ? Number(roomForm.area) : undefined,
        facilities: roomForm.facilities.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
        status: roomForm.status
      }));
      setNotice("房间信息已更新");
      setEditingRoomId(undefined);
      await loadRooms();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "保存房间失败");
    }
  };

  const deleteRoom = async () => {
    if (!organizationId || !selectedRoom) return;
    if (!canManageRoom) return setNotice("当前角色没有管理房间权限");
    if (selectedRoom.status === "OCCUPIED") return setNotice("已租房间不能删除，请先退租");
    try {
      await mobileApi(`/apartments/rooms/${selectedRoom.id}`, token, apiOptions(organizationId, "DELETE"));
      setNotice("房间已删除");
      setSelectedId(undefined);
      setEditingRoomId(undefined);
      await loadRooms();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "删除房间失败");
    }
  };

  const createLease = async () => {
    if (!organizationId || !selectedRoom) return;
    if (!canManageLease) return setNotice("当前角色没有管理租约权限");
    if (selectedRoom.status !== "VACANT") return setNotice("仅空闲房间可以签约");
    if (!leaseForm.tenantName.trim() || !leaseForm.tenantPhone.trim() || !leaseForm.rentAmount.trim()) {
      return setNotice("请填写租客、电话和租金");
    }
    const fees = [
      ...presetFees
        .filter((item) => item.amount.trim())
        .map((item) => ({ type: item.type, name: presetFeeTypes.find((p) => p.type === item.type)!.label, amount: Number(item.amount) })),
      ...customFees
        .filter((item) => item.name.trim() && item.amount.trim())
        .map((item) => ({ name: item.name.trim(), amount: Number(item.amount) }))
    ];
    try {
      await mobileApi("/leases", token, apiOptions(organizationId, "POST", {
        roomId: selectedRoom.id,
        tenantName: leaseForm.tenantName.trim(),
        tenantPhone: leaseForm.tenantPhone.trim(),
        startDate: leaseForm.startDate,
        endDate: leaseForm.endDate,
        graceDays: Number(leaseForm.graceDays || 0),
        cycle: leaseForm.cycle,
        rentAmount: Number(leaseForm.rentAmount),
        depositAmount: Number(leaseForm.depositAmount || 0),
        waterUnitPrice: Number(leaseForm.waterUnitPrice || 0),
        powerUnitPrice: Number(leaseForm.powerUnitPrice || 0),
        autoRenew: leaseForm.autoRenew,
        generateHistoricalBills: leaseForm.generateHistoricalBills,
        fees
      }));
      setNotice("签约完成，水电单价和费用项已带入租约");
      setLeaseForm((old) => ({ ...old, tenantName: "", tenantPhone: "", rentAmount: "", depositAmount: "", graceDays: "0", autoRenew: true, generateHistoricalBills: false }));
      setPresetFees([]);
      setCustomFees([]);
      setEditingRoomId(undefined);
      setLeaseRoomId(undefined);
      await loadRooms();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "签约失败");
    }
  };

  const startEditRoom = (room: Room) => {
    setSelectedId(room.id);
    setRoomForm({
      roomNo: room.roomNo,
      layout: room.layout,
      area: room.area ? String(room.area) : "",
      facilities: room.facilities.join(","),
      status: room.status
    });
    setEditingRoomId(room.id);
  };

  const openTermination = (lease: Lease) => {
    setTerminatingLease(lease);
    setPreviousReadings({ previousWater: 0, previousPower: 0 });
    setTerminationForm({
      type: defaultTerminationType(lease),
      terminatedAt: today(),
      reason: "",
      depositDeductionAmount: "0",
      depositDeductionReason: "",
      rentAdjustmentAmount: "0",
      currentWater: "0",
      currentPower: "0",
      otherFeeAmount: "0",
      otherFeeReason: ""
    });
    if (organizationId) {
      mobileApi<{ previousWater: string | number; previousPower: string | number }>(
        `/leases/${lease.id}/settlement-preview?terminatedAt=${encodeURIComponent(today())}`,
        token,
        apiOptions(organizationId)
      )
        .then((data) => setPreviousReadings({ previousWater: Number(data.previousWater ?? 0), previousPower: Number(data.previousPower ?? 0) }))
        .catch((error) => setNotice(error instanceof Error ? error.message : "退租读数加载失败"));
    }
  };

  const terminateLease = async () => {
    if (!organizationId || !terminatingLease) return;
    if (!canManageLease) return setNotice("当前角色没有管理租约权限");
    try {
      const settlement = await mobileApi<LeaseSettlement>(`/leases/${terminatingLease.id}/terminate`, token, apiOptions(organizationId, "POST", {
        type: terminationForm.type,
        reason: terminationForm.reason.trim() || terminationLabels[terminationForm.type],
        terminatedAt: terminationForm.terminatedAt,
        depositDeductionAmount: numberValue(terminationForm.depositDeductionAmount),
        depositDeductionReason: terminationForm.depositDeductionReason.trim() || undefined,
        rentAdjustmentAmount: numberValue(terminationForm.rentAdjustmentAmount),
        currentWater: numberValue(terminationForm.currentWater),
        currentPower: numberValue(terminationForm.currentPower),
        otherFeeAmount: numberValue(terminationForm.otherFeeAmount),
        otherFeeReason: terminationForm.otherFeeReason.trim() || undefined
      }));
      const net = Number(settlement.netAmount);
      setNotice(net > 0 ? `退租完成，租客应补交 ¥${money(net)}` : net < 0 ? `退租完成，应退租客 ¥${money(Math.abs(net))}` : "退租完成，结算已结清");
      setTerminatingLease(undefined);
      await loadRooms();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "退租失败");
    }
  };

  const togglePresetFee = (type: BillItemType) => {
    setPresetFees((old) => {
      const exists = old.some((item) => item.type === type);
      if (exists) return old.filter((item) => item.type !== type);
      return [...old, { type, amount: "" }];
    });
  };
  const updatePresetFeeAmount = (type: BillItemType, amount: string) => {
    setPresetFees((old) => old.map((item) => (item.type === type ? { ...item, amount } : item)));
  };

  const openLeaseForRoom = (room: Room) => {
    setSelectedId(room.id);
    setLeaseRoomId(room.id);
    setEditingRoomId(undefined);
    setQuickLeaseSelecting(false);
  };

  if (!organizationId) {
    return (
      <Card>
        <EmptyState icon="🏢" title="尚未选择组织" subtitle="请先从右上角用户菜单中选择一个组织" />
      </Card>
    );
  }

  return (
    <>
      {quickLeaseSelecting ? (
        <>
          <Card title="选择签约房间" subtitle="选择一间空闲房后填写租客和租约信息"
            headerAction={
              <Button variant="ghost" size="small" onPress={() => setQuickLeaseSelecting(false)} icon="arrow-back-outline">返回</Button>
            }
          >
            <Text style={styles.muted}>点击下方房间卡片进行签约</Text>
          </Card>

          {leaseCandidateRooms.length === 0 ? <EmptyState icon="🛏️" title="暂无空闲房间" subtitle="暂无空闲房间可签约" /> : null}

          <View style={styles.roomGrid}>
            {leaseCandidateRooms.map((room) => (
              <PressableScale key={room.id} onPress={() => openLeaseForRoom(room)}>
                <Card variant="outline" padding="md">
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View>
                      <Text style={styles.cardTitle}>{room.apartment?.name} · {room.roomNo}</Text>
                      <Text style={styles.muted}>{room.layout} · {room.area ? `${room.area}㎡` : "未填面积"}</Text>
                    </View>
                    <Badge tone="success">选择</Badge>
                  </View>
                </Card>
              </PressableScale>
            ))}
          </View>
        </>
      ) : (
        <>
          <View style={styles.statRow}>
            <Card padding="md" gap={8} style={{ flex: 1 }}>
              <Text style={styles.statLabel}>全部房间</Text>
              <Text style={styles.statValue}>{rooms.length}</Text>
            </Card>
            <Card padding="md" gap={8} style={{ flex: 1 }}>
              <Text style={styles.statLabel}>空闲</Text>
              <Text style={styles.statValue}>{vacantCount}</Text>
            </Card>
            <Card padding="md" gap={8} style={{ flex: 1 }}>
              <Text style={styles.statLabel}>已租</Text>
              <Text style={styles.statValue}>{occupiedCount}</Text>
            </Card>
          </View>

          {canManageLease ? (
            <Button onPress={() => setQuickLeaseSelecting(true)} icon="document-text-outline">签约入住</Button>
          ) : null}

          <View style={styles.filterBar}>
            {filters.map((item) => (
              <Button
                key={item}
                variant={filter === item ? "primary" : "ghost"}
                size="small"
                onPress={() => {
                  setFilter(item);
                  setSelectedId(undefined);
                  setEditingRoomId(undefined);
                  setLeaseRoomId(undefined);
                }}
              >
                {item === "ALL" ? "全部" : statusLabels[item]}
              </Button>
            ))}
          </View>

          {visibleRooms.length === 0 ? <EmptyState icon="🛏️" title="暂无房间" subtitle="请先到公寓页批量添加" /> : null}

          <View style={styles.roomGrid}>
            {visibleRooms.map((room) => {
              const expanded = selectedId === room.id;
              const roomActiveLease = room.leases?.find((item) => item.status === "ACTIVE");
              return (
                <PressableScale key={room.id} onPress={() => {
                  setSelectedId(expanded ? undefined : room.id);
                  setEditingRoomId(undefined);
                }}>
                  <Card style={expanded ? { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.primaryLightest } : undefined}>
                    <View style={styles.roomHeader}>
                      <View>
                        <Text style={styles.cardTitle}>{room.apartment?.name} · {room.roomNo}</Text>
                        <Text style={styles.muted}>{room.layout} · {room.area ? `${room.area}㎡` : "未填面积"}</Text>
                      </View>
                      <View style={styles.roomHeaderBadges}>
                        <Badge tone={toneForStatus[room.status]}>{statusLabels[room.status]}</Badge>
                        {roomActiveLease?.currentMonthBillGenerated ? (
                          <Badge tone="primary">{getRoomBillGeneratedLabel(roomActiveLease.currentMonthBillLabel)}</Badge>
                        ) : null}
                        {roomActiveLease?.currentMonthBillSettled ? <Badge tone="success">账单已结清</Badge> : null}
                      </View>
                    </View>
                    <Text style={styles.muted}>{room.facilities.length ? room.facilities.join("、") : "暂无设施"}</Text>

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
                          {canManageRoom ? (
                            <Button variant="secondary" size="small" onPress={() => startEditRoom(room)} icon="create-outline">编辑房间</Button>
                          ) : null}
                          {room.status === "VACANT" && canManageLease ? (
                            <Button size="small" onPress={() => {
                              setSelectedId(room.id);
                              setLeaseRoomId(room.id);
                              setEditingRoomId(undefined);
                            }}>签约入住</Button>
                          ) : null}
                          {canManageRoom ? (
                            <Button variant="danger" size="small" onPress={deleteRoom} icon="trash-outline">删除房间</Button>
                          ) : null}
                        </View>

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
                            <View style={styles.detailRow}>
                              <Text style={styles.muted}>交租周期</Text>
                              <Text style={styles.muted}>{cycleLabels[roomActiveLease.cycle]} · 宽限 {roomActiveLease.graceDays ?? 0} 天</Text>
                            </View>
                            <View style={styles.detailRow}>
                              <Text style={styles.muted}>自动续约</Text>
                              <Text style={styles.muted}>{roomActiveLease.autoRenew ? (roomActiveLease.isAutoRenewalPeriod ? "自动续约中" : "到期后自动续约") : "不自动续约"}</Text>
                            </View>
                            {canManageLease ? (
                              <Button variant="danger" size="small" onPress={() => openTermination(roomActiveLease)} icon="exit-outline">退租</Button>
                            ) : null}
                          </View>
                        ) : null}
                      </>
                    ) : null}
                  </Card>
                </PressableScale>
              );
            })}
          </View>
        </>
      )}
      <TaskSheet
        visible={Boolean(editingRoom)}
        variant="drawer"
        title="编辑房间"
        subtitle={editingRoom ? `${editingRoom.apartment?.name} · ${editingRoom.roomNo}` : undefined}
        onClose={() => setEditingRoomId(undefined)}
        footer={(
          <Button onPress={updateRoom} icon="save-outline">保存房间信息</Button>
        )}
      >
        <Input placeholder="房间号" value={roomForm.roomNo} onChangeText={(value) => setRoomForm((old) => ({ ...old, roomNo: value }))} />
        <View style={styles.formGrid}>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>户型</Text>
            <Input placeholder="例如 一室一卫" value={roomForm.layout} onChangeText={(value) => setRoomForm((old) => ({ ...old, layout: value }))} />
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>面积</Text>
            <Input placeholder="平方米" value={roomForm.area} keyboardType="numeric" onChangeText={(value) => setRoomForm((old) => ({ ...old, area: value }))} />
          </View>
        </View>
        <Input placeholder="设施，用逗号分隔" value={roomForm.facilities} onChangeText={(value) => setRoomForm((old) => ({ ...old, facilities: value }))} />
        <View style={styles.segment}>
          {(Object.keys(statusLabels) as RoomStatus[]).map((item) => (
            <View
              key={item}
              style={[styles.segmentItem, roomForm.status === item && styles.segmentItemActive]}
            >
              <Text style={[styles.segmentText, roomForm.status === item && styles.segmentTextActive]} onPress={() => setRoomForm((old) => ({ ...old, status: item }))}>
                {statusLabels[item]}
              </Text>
            </View>
          ))}
        </View>
      </TaskSheet>
      <TaskSheet
        visible={Boolean(leaseRoom)}
        variant="drawer"
        title="签约入住"
        subtitle={leaseRoom ? `${leaseRoom.apartment?.name} · ${leaseRoom.roomNo}` : undefined}
        onClose={() => {
          setLeaseRoomId(undefined);
          setPresetFees([]);
          setCustomFees([]);
        }}
        footer={(
          <Button onPress={createLease} icon="document-text-outline">确认签约</Button>
        )}
      >
        <Input placeholder="租客姓名" value={leaseForm.tenantName} onChangeText={(value) => setLeaseForm((old) => ({ ...old, tenantName: value }))} />
        <Input placeholder="租客电话" value={leaseForm.tenantPhone} onChangeText={(value) => setLeaseForm((old) => ({ ...old, tenantPhone: value }))} />
        <View style={styles.formGrid}>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>开始日期</Text>
            <DateField value={leaseForm.startDate} onChange={(value) => setLeaseForm((old) => ({ ...old, startDate: value }))} />
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>结束日期</Text>
            <DateField value={leaseForm.endDate} onChange={(value) => setLeaseForm((old) => ({ ...old, endDate: value }))} />
          </View>
        </View>
        <View style={styles.formGrid}>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>租金</Text>
            <Input placeholder="每期金额" value={leaseForm.rentAmount} keyboardType="numeric" onChangeText={(value) => setLeaseForm((old) => ({ ...old, rentAmount: value }))} />
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>押金</Text>
            <Input placeholder="押金金额" value={leaseForm.depositAmount} keyboardType="numeric" onChangeText={(value) => setLeaseForm((old) => ({ ...old, depositAmount: value }))} />
          </View>
        </View>
        <View style={styles.formGrid}>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>交租期限</Text>
            <Input placeholder="交租日后几日内" value={leaseForm.graceDays} keyboardType="numeric" onChangeText={(value) => setLeaseForm((old) => ({ ...old, graceDays: value }))} />
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>自动续约</Text>
            <View style={styles.segment}>
              {[true, false].map((item) => (
                <View
                  key={String(item)}
                  style={[styles.segmentItem, leaseForm.autoRenew === item && styles.segmentItemActive]}
                >
                  <Text style={[styles.segmentText, leaseForm.autoRenew === item && styles.segmentTextActive]} onPress={() => setLeaseForm((old) => ({ ...old, autoRenew: item }))}>
                    {item ? "开启" : "关闭"}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
        <View style={styles.segment}>
          {(["MONTHLY", "QUARTERLY", "YEARLY"] as RentCycle[]).map((item) => (
            <View
              key={item}
              style={[styles.segmentItem, leaseForm.cycle === item && styles.segmentItemActive]}
            >
              <Text style={[styles.segmentText, leaseForm.cycle === item && styles.segmentTextActive]} onPress={() => setLeaseForm((old) => ({ ...old, cycle: item }))}>
                {cycleLabels[item]}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.formGrid}>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>水费单价</Text>
            <Input placeholder="元/吨" value={leaseForm.waterUnitPrice} keyboardType="numeric" onChangeText={(value) => setLeaseForm((old) => ({ ...old, waterUnitPrice: value }))} />
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>电费单价</Text>
            <Input placeholder="元/度" value={leaseForm.powerUnitPrice} keyboardType="numeric" onChangeText={(value) => setLeaseForm((old) => ({ ...old, powerUnitPrice: value }))} />
          </View>
        </View>
        {new Date(leaseForm.startDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) ? (
          <View style={styles.formGrid}>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>历史账单</Text>
              <View style={styles.segment}>
                {[false, true].map((item) => (
                  <View
                    key={String(item)}
                    style={[styles.segmentItem, leaseForm.generateHistoricalBills === item && styles.segmentItemActive]}
                  >
                    <Text
                      style={[styles.segmentText, leaseForm.generateHistoricalBills === item && styles.segmentTextActive]}
                      onPress={() => setLeaseForm((old) => ({ ...old, generateHistoricalBills: item }))}
                    >
                      {item ? "生成全部" : "仅当前期"}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : null}
        <Text style={styles.label}>费用项目</Text>
        {presetFeeTypes.map(({ type, label }) => {
          const selected = presetFees.find((item) => item.type === type);
          return (
            <View key={type} style={{ gap: 8 }}>
              <PressableScale onPress={() => togglePresetFee(type)}>
                <Card variant={selected ? "default" : "outline"} padding="sm" gap={8}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={selected ? styles.cardTitle : styles.muted}>{label}</Text>
                    <Text style={selected ? styles.cardStat : styles.muted}>{selected ? `¥${money(selected.amount)}` : "点击添加"}</Text>
                  </View>
                </Card>
              </PressableScale>
              {selected ? (
                <Input placeholder="输入金额" value={selected.amount} keyboardType="numeric" onChangeText={(value) => updatePresetFeeAmount(type, value)} />
              ) : null}
            </View>
          );
        })}
        {customFees.length > 0 ? <Text style={styles.label}>其他费用</Text> : null}
        {customFees.map((item, index) => (
          <View key={item.id} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Input placeholder="费用名称" value={item.name} onChangeText={(value) => setCustomFees((old) => old.map((f, i) => (i === index ? { ...f, name: value } : f)))} />
            </View>
            <View style={{ flex: 1 }}>
              <Input placeholder="金额" value={item.amount} keyboardType="numeric" onChangeText={(value) => setCustomFees((old) => old.map((f, i) => (i === index ? { ...f, amount: value } : f)))} />
            </View>
            <PressableScale onPress={() => setCustomFees((old) => old.filter((_, i) => i !== index))}>
              <Text style={styles.smallDangerText}>删除</Text>
            </PressableScale>
          </View>
        ))}
        <Button variant="secondary" size="small" onPress={() => setCustomFees((old) => [...old, { id: `${Date.now()}-${old.length}`, name: "", amount: "" }])} icon="add-circle-outline">添加其他费用</Button>
      </TaskSheet>
      <TaskSheet
        visible={Boolean(terminatingLease)}
        variant="drawer"
        title="合约终止"
        subtitle={terminatingLease ? `${terminatingLease.tenantName} · ${terminatingLease.startDate.slice(0, 10)} 至 ${terminatingLease.endDate.slice(0, 10)}` : undefined}
        onClose={() => setTerminatingLease(undefined)}
        footer={(
          <Button variant="danger" onPress={terminateLease} icon="exit-outline">确认终止合约</Button>
        )}
      >
        <View style={styles.segment}>
          {(Object.keys(terminationLabels) as TerminationType[]).map((item) => (
            <View
              key={item}
              style={[styles.segmentItem, terminationForm.type === item && styles.segmentItemActive]}
            >
              <Text style={[styles.segmentText, terminationForm.type === item && styles.segmentTextActive]} onPress={() => setTerminationForm((old) => ({ ...old, type: item }))}>
                {terminationLabels[item]}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.fieldLabel}>退租日期</Text>
        <DateField value={terminationForm.terminatedAt} onChange={(value) => setTerminationForm((old) => ({ ...old, terminatedAt: value }))} />
        <View style={styles.detailPanel}>
          <View style={styles.detailRow}>
            <Text style={styles.muted}>原押金</Text>
            <Text style={styles.cardStat}>¥{money(terminatingLease?.depositAmount)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.muted}>预计退押金</Text>
            <Text style={styles.cardStat}>¥{money(settlementPreview.depositRefund)}</Text>
          </View>
        </View>
        <View style={styles.formGrid}>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>押金扣款</Text>
            <Input keyboardType="numeric" value={terminationForm.depositDeductionAmount} onChangeText={(value) => setTerminationForm((old) => ({ ...old, depositDeductionAmount: value }))} />
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>房租退补</Text>
            <Input keyboardType="numeric" value={terminationForm.rentAdjustmentAmount} onChangeText={(value) => setTerminationForm((old) => ({ ...old, rentAdjustmentAmount: value }))} />
          </View>
        </View>
        <Input placeholder="押金扣款原因" value={terminationForm.depositDeductionReason} onChangeText={(value) => setTerminationForm((old) => ({ ...old, depositDeductionReason: value }))} />
        <View style={styles.formGrid}>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>退租水表读数</Text>
            <Input keyboardType="numeric" value={terminationForm.currentWater} onChangeText={(value) => setTerminationForm((old) => ({ ...old, currentWater: value }))} />
            <Text style={styles.muted}>上次 {money(previousReadings.previousWater)}</Text>
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>退租电表读数</Text>
            <Input keyboardType="numeric" value={terminationForm.currentPower} onChangeText={(value) => setTerminationForm((old) => ({ ...old, currentPower: value }))} />
            <Text style={styles.muted}>上次 {money(previousReadings.previousPower)}</Text>
          </View>
        </View>
        <View style={styles.formGrid}>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>其他费用</Text>
            <Input keyboardType="numeric" value={terminationForm.otherFeeAmount} onChangeText={(value) => setTerminationForm((old) => ({ ...old, otherFeeAmount: value }))} />
          </View>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>预估水电费</Text>
            <View style={[styles.input, styles.dateField]}>
              <Text style={styles.dateFieldText}>¥{money(settlementPreview.utility)}</Text>
            </View>
          </View>
        </View>
        <Input placeholder="其他费用说明" value={terminationForm.otherFeeReason} onChangeText={(value) => setTerminationForm((old) => ({ ...old, otherFeeReason: value }))} />
        <View style={styles.detailPanel}>
          <View style={styles.detailRow}>
            <Text style={styles.muted}>应收</Text>
            <Text style={styles.cardStat}>¥{money(settlementPreview.receivable)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.muted}>应退</Text>
            <Text style={styles.cardStat}>¥{money(settlementPreview.refundable)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.muted}>结算结果</Text>
            <Text style={settlementPreview.net >= 0 ? styles.cardStat : styles.smallDangerText}>
              {settlementPreview.net > 0 ? `租客补交 ¥${money(settlementPreview.net)}` : settlementPreview.net < 0 ? `退租客 ¥${money(Math.abs(settlementPreview.net))}` : "结清"}
            </Text>
          </View>
        </View>
        <Text style={styles.fieldLabel}>原因</Text>
        <Input multiline placeholder="可选，默认使用解约类型" value={terminationForm.reason} onChangeText={(value) => setTerminationForm((old) => ({ ...old, reason: value }))} />
        {terminatingLease?.isAutoRenewalPeriod ? <Text style={styles.muted}>当前租约已进入自动续约期，到期后退房不默认视为违约。</Text> : null}
      </TaskSheet>
    </>
  );
}
