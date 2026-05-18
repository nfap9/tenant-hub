import { useState, useMemo, useCallback } from 'react';
import { ScrollView, View, Text } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { useAppSession, useHasPermission } from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { Button, Card, EmptyState, Badge, Input, DateField, FacilitySelector } from '../../components/ui';
import { NoOrganization } from '../../components/NoOrganization';
import { TaskSheet } from '../../components/TaskSheet';
import { money, today, nextYear, numberValue } from '../../utils/format';
import type { Room, RoomStatus, Lease, RentCycle, BillItemType, TerminationType } from '../../types/domain';
import './index.scss';

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

const filters: Array<RoomStatus | "ALL"> = ["ALL", "VACANT", "OCCUPIED", "RESERVED", "MAINTENANCE"];
const roomStatuses: RoomStatus[] = ["VACANT", "RESERVED", "OCCUPIED", "MAINTENANCE"];
const cycleLabels: Record<RentCycle, string> = { MONTHLY: "月付", QUARTERLY: "季付", YEARLY: "年付" };
const selectableFeeTypes: Array<{ type: BillItemType; label: string }> = [
  { type: "MANAGEMENT", label: "管理费" },
  { type: "SANITATION", label: "卫生费" },
  { type: "ELEVATOR", label: "电梯费" },
  { type: "PROPERTY", label: "物业费" },
  { type: "NETWORK", label: "网费" },
  { type: "OTHER", label: "其他费用" }
];
const feeTypeLabels = selectableFeeTypes.reduce((labels, item) => ({ ...labels, [item.type]: item.label }), {} as Partial<Record<BillItemType, string>>);
const terminationLabels: Record<TerminationType, string> = { EXPIRED: "到期解约", NEGOTIATED: "协商解约", BREACH: "违约退租" };
type LeaseFeeFormItem = { id: string; type: BillItemType; name: string; amount: string };

export default function RoomsPage() {
  const { currentOrgId } = useAppSession();
  const canManageRoom = useHasPermission("room:manage");
  const canManageLease = useHasPermission("lease:manage");

  const [rooms, setRooms] = useState<Room[]>([]);
  const [filter, setFilter] = useState<RoomStatus | "ALL">("ALL");
  const [selectedId, setSelectedId] = useState<string>();
  const [editingRoomId, setEditingRoomId] = useState<string>();
  const [leaseRoomId, setLeaseRoomId] = useState<string>();
  const [roomForm, setRoomForm] = useState({ roomNo: "", layout: "", area: "", facilities: "", status: "VACANT" as RoomStatus });
  const [leaseForm, setLeaseForm] = useState({
    tenantName: "",
    tenantPhone: "",
    startDate: today(),
    endDate: nextYear(),
    graceDays: "0",
    cycle: "MONTHLY" as RentCycle,
    rentAmount: "",
    depositAmount: "",
    waterUnitPrice: "0",
    powerUnitPrice: "0",
    autoRenew: true,
    generateHistoricalBills: false
  });
  const [leaseFees, setLeaseFees] = useState<LeaseFeeFormItem[]>([]);
  const [editingLease, setEditingLease] = useState<Lease>();
  const [editLeaseForm, setEditLeaseForm] = useState({ rentAmount: "", depositAmount: "", waterUnitPrice: "0", powerUnitPrice: "0" });
  const [terminatingLease, setTerminatingLease] = useState<Lease>();
  const [previousReadings, setPreviousReadings] = useState({ previousWater: 0, previousPower: 0 });
  const [terminationForm, setTerminationForm] = useState({
    type: "NEGOTIATED" as TerminationType,
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
  const vacantCount = rooms.filter((item) => item.status === "VACANT").length;
  const occupiedCount = rooms.filter((item) => item.status === "OCCUPIED").length;

  const loadRooms = useCallback(async () => {
    if (!currentOrgId) return;
    try {
      const data = await apiClient<Room[]>("/apartments/rooms", { organizationId: currentOrgId });
      setRooms(data);
      setSelectedId((old) => (old && data.some((item) => item.id === old) ? old : undefined));
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "加载失败", icon: "none" });
    }
  }, [currentOrgId]);

  useDidShow(() => {
    loadRooms();
  });

  usePullDownRefresh(() => {
    loadRooms().finally(() => Taro.stopPullDownRefresh());
  });

  const updateRoom = async () => {
    if (!currentOrgId || !editingRoom) return;
    if (!canManageRoom) return Taro.showToast({ title: "当前角色没有管理房间权限", icon: "none" });
    try {
      await apiClient(`/apartments/rooms/${editingRoom.id}`, {
        method: "PUT",
        body: {
          roomNo: roomForm.roomNo.trim(),
          layout: roomForm.layout.trim(),
          area: roomForm.area.trim() ? Number(roomForm.area) : undefined,
          facilities: roomForm.facilities.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
          status: roomForm.status
        },
        organizationId: currentOrgId
      });
      Taro.showToast({ title: "房间信息已更新", icon: "success" });
      setEditingRoomId(undefined);
      await loadRooms();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "保存房间失败", icon: "none" });
    }
  };

  const deleteRoom = async () => {
    if (!currentOrgId || !selectedRoom) return;
    if (!canManageRoom) return Taro.showToast({ title: "当前角色没有管理房间权限", icon: "none" });
    if (selectedRoom.status === "OCCUPIED") return Taro.showToast({ title: "已租房间不能删除，请先退租", icon: "none" });
    try {
      await apiClient(`/apartments/rooms/${selectedRoom.id}`, { method: "DELETE", organizationId: currentOrgId });
      Taro.showToast({ title: "房间已删除", icon: "success" });
      setSelectedId(undefined);
      setEditingRoomId(undefined);
      await loadRooms();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "删除房间失败", icon: "none" });
    }
  };

  const createLease = async () => {
    if (!currentOrgId || !leaseRoom) return;
    if (!canManageLease) return Taro.showToast({ title: "当前角色没有管理租约权限", icon: "none" });
    if (leaseRoom.status !== "VACANT") return Taro.showToast({ title: "仅空闲房间可以签约", icon: "none" });
    if (!leaseForm.tenantName.trim() || !leaseForm.tenantPhone.trim() || !leaseForm.rentAmount.trim()) {
      return Taro.showToast({ title: "请填写租客、电话和租金", icon: "none" });
    }
    const fees = leaseFees
      .filter((item) => item.name.trim() && item.amount.trim())
      .map((item) => ({
        type: item.type,
        name: item.name.trim(),
        amount: Number(item.amount)
      }));
    try {
      await apiClient("/leases", {
        method: "POST",
        body: {
          roomId: leaseRoom.id,
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
        },
        organizationId: currentOrgId
      });
      Taro.showToast({ title: "签约完成", icon: "success" });
      setLeaseForm({ tenantName: "", tenantPhone: "", startDate: today(), endDate: nextYear(), graceDays: "0", cycle: "MONTHLY", rentAmount: "", depositAmount: "", waterUnitPrice: "0", powerUnitPrice: "0", autoRenew: true, generateHistoricalBills: false });
      setLeaseFees([]);
      setLeaseRoomId(undefined);
      setSelectedId(undefined);
      await loadRooms();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "签约失败", icon: "none" });
    }
  };

  const updateLease = async () => {
    if (!currentOrgId || !editingLease) return;
    if (!canManageLease) return Taro.showToast({ title: "当前角色没有管理租约权限", icon: "none" });
    const fees = leaseFees
      .filter((item) => item.name.trim() && item.amount.trim())
      .map((item) => ({
        type: item.type,
        name: item.name.trim(),
        amount: Number(item.amount)
      }));
    try {
      await apiClient(`/leases/${editingLease.id}`, {
        method: "PUT",
        body: {
          rentAmount: editLeaseForm.rentAmount.trim() ? Number(editLeaseForm.rentAmount) : undefined,
          depositAmount: editLeaseForm.depositAmount.trim() ? Number(editLeaseForm.depositAmount) : undefined,
          waterUnitPrice: Number(editLeaseForm.waterUnitPrice || 0),
          powerUnitPrice: Number(editLeaseForm.powerUnitPrice || 0),
          fees
        },
        organizationId: currentOrgId
      });
      Taro.showToast({ title: "租约信息已更新", icon: "success" });
      setEditingLease(undefined);
      setLeaseFees([]);
      await loadRooms();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "更新租约失败", icon: "none" });
    }
  };

  const openTermination = (lease: Lease) => {
    setTerminatingLease(lease);
    setPreviousReadings({ previousWater: 0, previousPower: 0 });
    const defaultType: TerminationType = today() > lease.endDate.slice(0, 10) ? "EXPIRED" : "NEGOTIATED";
    setTerminationForm({
      type: defaultType,
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
    if (currentOrgId) {
      apiClient<{ previousWater: string | number; previousPower: string | number }>(`/leases/${lease.id}/settlement-preview?terminatedAt=${encodeURIComponent(today())}`, { organizationId: currentOrgId })
        .then((data) => setPreviousReadings({ previousWater: Number(data.previousWater ?? 0), previousPower: Number(data.previousPower ?? 0) }))
        .catch((e) => Taro.showToast({ title: e instanceof Error ? e.message : "退租读数加载失败", icon: "none" }));
    }
  };

  const terminateLease = async () => {
    if (!currentOrgId || !terminatingLease) return;
    if (!canManageLease) return Taro.showToast({ title: "当前角色没有管理租约权限", icon: "none" });
    try {
      const settlement = await apiClient(`/leases/${terminatingLease.id}/terminate`, {
        method: "POST",
        body: {
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
        },
        organizationId: currentOrgId
      });
      const net = Number((settlement as { netAmount: string | number }).netAmount);
      Taro.showToast({ title: net > 0 ? `退租完成，租客应补交 ¥${money(net)}` : net < 0 ? `退租完成，应退租客 ¥${money(Math.abs(net))}` : "退租完成，结算已结清", icon: "success" });
      setTerminatingLease(undefined);
      setSelectedId(undefined);
      await loadRooms();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "退租失败", icon: "none" });
    }
  };

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

  const addLeaseFee = async () => {
    const availableTypes = selectableFeeTypes.filter((item) => !leaseFees.some((fee) => fee.type === item.type));
    if (availableTypes.length === 0) {
      Taro.showToast({ title: "费用项目已全部添加", icon: "none" });
      return;
    }
    try {
      const result = await Taro.showActionSheet({ itemList: availableTypes.map((item) => item.label) });
      const selectedType = availableTypes[result.tapIndex];
      if (!selectedType) return;
      setLeaseFees((old) => [...old, { id: `${selectedType.type}-${Date.now()}`, type: selectedType.type, name: selectedType.label, amount: "" }]);
    } catch {
      // User cancelled the action sheet.
    }
  };

  const updateLeaseFeeAmount = (id: string, amount: string) => {
    setLeaseFees((old) => old.map((item) => (item.id === id ? { ...item, amount } : item)));
  };

  const removeLeaseFee = (id: string) => {
    setLeaseFees((old) => old.filter((item) => item.id !== id));
  };

  if (!currentOrgId) {
    return <NoOrganization />;
  }

  return (
    <View className="page-container">
      <View className="rooms-fixed-header">
        <View className="stat-row">
          <Card className="stat-card">
            <Text className="stat-label">全部房间</Text>
            <Text className="stat-value">{rooms.length}</Text>
          </Card>
          <Card className="stat-card">
            <Text className="stat-label">空闲</Text>
            <Text className="stat-value">{vacantCount}</Text>
          </Card>
          <Card className="stat-card">
            <Text className="stat-label">已租</Text>
            <Text className="stat-value">{occupiedCount}</Text>
          </Card>
        </View>

        <View className="filter-bar">
          {filters.map((item) => (
            <Button key={item} variant={filter === item ? "primary" : "ghost"} size="small" onClick={() => { setFilter(item); setSelectedId(undefined); setLeaseRoomId(undefined); setEditingRoomId(undefined); }}>
              {item === "ALL" ? "全部" : statusLabels[item]}
            </Button>
          ))}
        </View>
      </View>

      <ScrollView className="rooms-list" scrollY>
        {visibleRooms.length === 0 ? <EmptyState icon="room" title="暂无房间" subtitle="请先到公寓页批量添加" /> : null}

        {visibleRooms.map((room) => {
          const expanded = selectedId === room.id;
          const roomActiveLease = room.leases?.find((item) => item.status === "ACTIVE");
          return (
            <View key={room.id} className={`room-card ${expanded ? 'room-card--active' : ''}`} onClick={() => {
              setSelectedId(expanded ? undefined : room.id);
              setEditingRoomId(undefined);
            }}>
              <View className="room-header">
                <View>
                  <Text className="card-title">{room.apartment?.name} · {room.roomNo}</Text>
                  <Text className="text-muted">{room.layout} · {room.area ? `${room.area}㎡` : "未填面积"}</Text>
                </View>
                <View className="room-badges">
                  <Badge tone={toneForStatus[room.status]}>{statusLabels[room.status]}</Badge>
                  {roomActiveLease?.currentMonthBillSettled ? <Badge tone="success">账单已结清</Badge> : null}
                </View>
              </View>
              <Text className="text-muted">{room.facilities.length ? room.facilities.join("、") : "暂无设施"}</Text>

              {expanded ? (
                <>
                  <View className="action-row-inline">
                    {canManageRoom ? <Button variant="secondary" size="small" onClick={() => {
                      setRoomForm({ roomNo: room.roomNo, layout: room.layout, area: room.area ? String(room.area) : "", facilities: room.facilities.join(","), status: room.status });
                      setEditingRoomId(room.id);
                    }}>编辑房间</Button> : null}
                    {room.status === "VACANT" && canManageLease ? <Button size="small" onClick={() => { setSelectedId(room.id); setLeaseRoomId(room.id); setEditingRoomId(undefined); }}>签约入住</Button> : null}
                    {canManageRoom ? (
                      <View onClick={(e) => { e.stopPropagation(); Taro.showModal({ title: "删除房间", content: "删除后房间资料不可恢复，请确认当前房间没有有效租约。", confirmText: "确认删除", confirmColor: "#c2413d" }).then((res) => { if (res.confirm) deleteRoom(); }); }}>
                        <Button variant="danger" size="small">删除房间</Button>
                      </View>
                    ) : null}
                  </View>

                  {room.status === "OCCUPIED" && roomActiveLease ? (
                    <View className="detail-panel">
                      <Text className="section-label">在租信息</Text>
                      <View className="detail-row"><Text className="text-muted">租客</Text><Text className="card-title">{roomActiveLease.tenantName}</Text></View>
                      <View className="detail-row"><Text className="text-muted">租金</Text><Text className="card-stat">¥{money(roomActiveLease.rentAmount)}</Text></View>
                      <View className="detail-row"><Text className="text-muted">合同期</Text><Text className="text-muted">{roomActiveLease.startDate.slice(0, 10)} 至 {roomActiveLease.endDate.slice(0, 10)}</Text></View>
                      <View className="detail-row"><Text className="text-muted">交租周期</Text><Text className="text-muted">{cycleLabels[roomActiveLease.cycle]} · 宽限 {roomActiveLease.graceDays ?? 0} 天</Text></View>
                      <View className="detail-row"><Text className="text-muted">自动续约</Text><Text className="text-muted">{roomActiveLease.autoRenew ? (roomActiveLease.isAutoRenewalPeriod ? "自动续约中" : "到期后自动续约") : "不自动续约"}</Text></View>
                      {canManageLease ? (
                        <View className="action-row-inline">
                          <Button variant="secondary" size="small" onClick={() => {
                            setEditingLease(roomActiveLease);
                            setEditLeaseForm({ rentAmount: String(roomActiveLease.rentAmount ?? ""), depositAmount: String(roomActiveLease.depositAmount ?? ""), waterUnitPrice: String(roomActiveLease.waterUnitPrice ?? 0), powerUnitPrice: String(roomActiveLease.powerUnitPrice ?? 0) });
                            const fees = roomActiveLease.fees ?? [];
                            setLeaseFees(fees.map((fee) => ({
                              id: fee.id,
                              type: fee.type,
                              name: fee.name || feeTypeLabels[fee.type] || "其他费用",
                              amount: String(fee.amount)
                            })));
                          }}>编辑租约</Button>
                          <Button variant="danger" size="small" onClick={() => openTermination(roomActiveLease)}>退租</Button>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <TaskSheet
        visible={!!editingRoom}
        title="编辑房间"
        onClose={() => setEditingRoomId(undefined)}
        footer={(
          <>
            <Button onClick={updateRoom}>保存房间信息</Button>
            <Button variant="ghost" onClick={() => setEditingRoomId(undefined)}>取消</Button>
          </>
        )}
      >
            <Input label="房间号" placeholder="例如 301" value={roomForm.roomNo} onChange={(value) => setRoomForm((old) => ({ ...old, roomNo: value }))} />
            <View className="form-grid">
              <Input label="户型" placeholder="例如 开间" value={roomForm.layout} onChange={(value) => setRoomForm((old) => ({ ...old, layout: value }))} />
              <Input label="面积" placeholder="平方米" type="number" value={roomForm.area} onChange={(value) => setRoomForm((old) => ({ ...old, area: value }))} />
            </View>
            <FacilitySelector value={roomForm.facilities} onChange={(value) => setRoomForm((old) => ({ ...old, facilities: value }))} />
            <View className="segment">
              {roomStatuses.map((item) => (
                <View key={item} className={`segment-item ${roomForm.status === item ? 'segment-item--active' : ''}`} onClick={() => setRoomForm((old) => ({ ...old, status: item }))}>
                  <Text className={`segment-text ${roomForm.status === item ? 'segment-text--active' : ''}`}>{statusLabels[item]}</Text>
                </View>
              ))}
            </View>
      </TaskSheet>

      <TaskSheet
        visible={!!leaseRoom}
        title="签约入住"
        onClose={() => { setLeaseRoomId(undefined); setLeaseFees([]); }}
        footer={(
          <>
            <Button onClick={createLease}>确认签约</Button>
            <Button variant="ghost" onClick={() => { setLeaseRoomId(undefined); setLeaseFees([]); }}>取消</Button>
          </>
        )}
      >
            <Input label="租客姓名" placeholder="请输入姓名" value={leaseForm.tenantName} onChange={(value) => setLeaseForm((old) => ({ ...old, tenantName: value }))} />
            <Input label="租客电话" placeholder="请输入手机号" value={leaseForm.tenantPhone} onChange={(value) => setLeaseForm((old) => ({ ...old, tenantPhone: value }))} />
            <View className="form-grid">
              <DateField label="开始日期" placeholder="选择日期" value={leaseForm.startDate} onChange={(value) => setLeaseForm((old) => ({ ...old, startDate: value }))} />
              <DateField label="结束日期" placeholder="选择日期" value={leaseForm.endDate} onChange={(value) => setLeaseForm((old) => ({ ...old, endDate: value }))} />
            </View>
            <View className="form-grid">
              <Input label="租金" placeholder="每期金额" type="number" value={leaseForm.rentAmount} onChange={(value) => setLeaseForm((old) => ({ ...old, rentAmount: value }))} />
              <Input label="押金" placeholder="请输入押金" type="number" value={leaseForm.depositAmount} onChange={(value) => setLeaseForm((old) => ({ ...old, depositAmount: value }))} />
            </View>
            <View className="form-grid">
              <Input label="宽限天数" placeholder="交租日后几日内" type="number" value={leaseForm.graceDays} onChange={(value) => setLeaseForm((old) => ({ ...old, graceDays: value }))} />
            </View>
            <Text className="field-label">交租周期</Text>
            <View className="segment">
              {(["MONTHLY", "QUARTERLY", "YEARLY"] as RentCycle[]).map((item) => (
                <View key={item} className={`segment-item ${leaseForm.cycle === item ? 'segment-item--active' : ''}`} onClick={() => setLeaseForm((old) => ({ ...old, cycle: item }))}>
                  <Text className={`segment-text ${leaseForm.cycle === item ? 'segment-text--active' : ''}`}>{cycleLabels[item]}</Text>
                </View>
              ))}
            </View>
            <View className="form-grid">
              <Input label="水费单价" placeholder="元/吨" type="number" value={leaseForm.waterUnitPrice} onChange={(value) => setLeaseForm((old) => ({ ...old, waterUnitPrice: value }))} />
              <Input label="电费单价" placeholder="元/度" type="number" value={leaseForm.powerUnitPrice} onChange={(value) => setLeaseForm((old) => ({ ...old, powerUnitPrice: value }))} />
            </View>
            <Text className="field-label">自动续约</Text>
            <View className="segment">
              {[true, false].map((item) => (
                <View key={String(item)} className={`segment-item ${leaseForm.autoRenew === item ? 'segment-item--active' : ''}`} onClick={() => setLeaseForm((old) => ({ ...old, autoRenew: item }))}>
                  <Text className={`segment-text ${leaseForm.autoRenew === item ? 'segment-text--active' : ''}`}>{item ? "开启" : "关闭"}</Text>
                </View>
              ))}
            </View>
            {new Date(leaseForm.startDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) ? (
              <>
                <Text className="field-label">历史账单</Text>
                <View className="segment">
                  {[false, true].map((item) => (
                    <View key={String(item)} className={`segment-item ${leaseForm.generateHistoricalBills === item ? 'segment-item--active' : ''}`} onClick={() => setLeaseForm((old) => ({ ...old, generateHistoricalBills: item }))}>
                      <Text className={`segment-text ${leaseForm.generateHistoricalBills === item ? 'segment-text--active' : ''}`}>{item ? "生成全部" : "仅当前期"}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
            <Text className="field-label">费用项目</Text>
            <View className="fee-list">
              {leaseFees.map((item) => (
                <View key={item.id} className="fee-row">
                  <Text className="fee-row__type">{item.name}</Text>
                  <Input label="" placeholder="价格" type="number" value={item.amount} onChange={(value) => updateLeaseFeeAmount(item.id, value)} />
                  <Text className="danger-text" onClick={() => removeLeaseFee(item.id)}>删除</Text>
                </View>
              ))}
            </View>
            <Button variant="secondary" size="small" onClick={addLeaseFee}>添加费用</Button>
      </TaskSheet>

      <TaskSheet
        visible={!!editingLease}
        title="编辑租约"
        onClose={() => { setEditingLease(undefined); setLeaseFees([]); }}
        footer={(
          <>
            <Button onClick={updateLease}>保存修改</Button>
            <Button variant="ghost" onClick={() => { setEditingLease(undefined); setLeaseFees([]); }}>取消</Button>
          </>
        )}
      >
            <View className="form-grid">
              <Input label="租金" placeholder="每期金额" type="number" value={editLeaseForm.rentAmount} onChange={(value) => setEditLeaseForm((old) => ({ ...old, rentAmount: value }))} />
              <Input label="押金" placeholder="请输入押金" type="number" value={editLeaseForm.depositAmount} onChange={(value) => setEditLeaseForm((old) => ({ ...old, depositAmount: value }))} />
            </View>
            <View className="form-grid">
              <Input label="水费单价" placeholder="元/吨" type="number" value={editLeaseForm.waterUnitPrice} onChange={(value) => setEditLeaseForm((old) => ({ ...old, waterUnitPrice: value }))} />
              <Input label="电费单价" placeholder="元/度" type="number" value={editLeaseForm.powerUnitPrice} onChange={(value) => setEditLeaseForm((old) => ({ ...old, powerUnitPrice: value }))} />
            </View>
            <Text className="field-label">费用项目</Text>
            <View className="fee-list">
              {leaseFees.map((item) => (
                <View key={item.id} className="fee-row">
                  <Text className="fee-row__type">{item.name}</Text>
                  <Input label="" placeholder="价格" type="number" value={item.amount} onChange={(value) => updateLeaseFeeAmount(item.id, value)} />
                  <Text className="danger-text" onClick={() => removeLeaseFee(item.id)}>删除</Text>
                </View>
              ))}
            </View>
            <Button variant="secondary" size="small" onClick={addLeaseFee}>添加费用</Button>
      </TaskSheet>

      <TaskSheet
        visible={!!terminatingLease}
        title="合约终止"
        onClose={() => setTerminatingLease(undefined)}
        footer={(
          <>
            <Button variant="danger" onClick={terminateLease}>确认终止合约</Button>
            <Button variant="ghost" onClick={() => setTerminatingLease(undefined)}>取消</Button>
          </>
        )}
      >
          {terminatingLease ? (
          <>
            <View className="segment">
              {(["EXPIRED", "NEGOTIATED", "BREACH"] as TerminationType[]).map((item) => (
                <View key={item} className={`segment-item ${terminationForm.type === item ? 'segment-item--active' : ''}`} onClick={() => setTerminationForm((old) => ({ ...old, type: item }))}>
                  <Text className={`segment-text ${terminationForm.type === item ? 'segment-text--active' : ''}`}>{terminationLabels[item]}</Text>
                </View>
              ))}
            </View>
            <DateField label="退租日期" placeholder="选择日期" value={terminationForm.terminatedAt} onChange={(value) => setTerminationForm((old) => ({ ...old, terminatedAt: value }))} />
            <View className="detail-panel">
              <View className="detail-row"><Text className="text-muted">原押金</Text><Text className="card-stat">¥{money(terminatingLease.depositAmount)}</Text></View>
              <View className="detail-row"><Text className="text-muted">预计退押金</Text><Text className="card-stat">¥{money(settlementPreview.depositRefund)}</Text></View>
            </View>
            <View className="form-grid">
              <Input label="押金扣款" placeholder="请输入金额" type="number" value={terminationForm.depositDeductionAmount} onChange={(value) => setTerminationForm((old) => ({ ...old, depositDeductionAmount: value }))} />
              <Input label="房租退补" placeholder="正数补收，负数退款" type="number" value={terminationForm.rentAdjustmentAmount} onChange={(value) => setTerminationForm((old) => ({ ...old, rentAdjustmentAmount: value }))} />
            </View>
            <Input label="押金扣款原因" placeholder="可选" value={terminationForm.depositDeductionReason} onChange={(value) => setTerminationForm((old) => ({ ...old, depositDeductionReason: value }))} />
            <View className="form-grid">
              <View>
                <Input label="退租水表读数" placeholder="当前读数" type="number" value={terminationForm.currentWater} onChange={(value) => setTerminationForm((old) => ({ ...old, currentWater: value }))} />
                <Text className="text-muted">上次 {money(previousReadings.previousWater)}</Text>
              </View>
              <View>
                <Input label="退租电表读数" placeholder="当前读数" type="number" value={terminationForm.currentPower} onChange={(value) => setTerminationForm((old) => ({ ...old, currentPower: value }))} />
                <Text className="text-muted">上次 {money(previousReadings.previousPower)}</Text>
              </View>
            </View>
            <View className="form-grid">
              <Input label="其他费用" placeholder="请输入金额" type="number" value={terminationForm.otherFeeAmount} onChange={(value) => setTerminationForm((old) => ({ ...old, otherFeeAmount: value }))} />
              <View>
                <Text className="field-label">预估水电费</Text>
                <Text className="card-stat">¥{money(settlementPreview.utility)}</Text>
              </View>
            </View>
            <Input label="其他费用说明" placeholder="可选" value={terminationForm.otherFeeReason} onChange={(value) => setTerminationForm((old) => ({ ...old, otherFeeReason: value }))} />
            <View className="detail-panel">
              <View className="detail-row"><Text className="text-muted">应收</Text><Text className="card-stat">¥{money(settlementPreview.receivable)}</Text></View>
              <View className="detail-row"><Text className="text-muted">应退</Text><Text className="card-stat">¥{money(settlementPreview.refundable)}</Text></View>
              <View className="detail-row"><Text className="text-muted">结算结果</Text>
                <Text className={settlementPreview.net >= 0 ? "card-stat" : "danger-text"}>
                  {settlementPreview.net > 0 ? `租客补交 ¥${money(settlementPreview.net)}` : settlementPreview.net < 0 ? `退租客 ¥${money(Math.abs(settlementPreview.net))}` : "结清"}
                </Text>
              </View>
            </View>
            <Input label="退租原因" placeholder="可选" value={terminationForm.reason} onChange={(value) => setTerminationForm((old) => ({ ...old, reason: value }))} />
            {terminatingLease?.isAutoRenewalPeriod ? <Text className="text-muted">当前租约已进入自动续约期，到期后退房不默认视为违约。</Text> : null}
          </>
          ) : null}
      </TaskSheet>
    </View>
  );
}
