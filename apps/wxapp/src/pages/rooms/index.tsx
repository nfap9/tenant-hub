import { useState, useMemo, useCallback } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { useAppSession, useHasPermission } from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { Button, Card, EmptyState, Badge } from '../../components/ui';
import { NoOrganization } from '../../components/NoOrganization';
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
const presetFeeTypes: Array<{ type: BillItemType; label: string }> = [
  { type: "MANAGEMENT", label: "管理费" },
  { type: "SANITATION", label: "卫生费" },
  { type: "ELEVATOR", label: "电梯费" },
  { type: "PROPERTY", label: "物业费" },
  { type: "NETWORK", label: "网费" }
];
const terminationLabels: Record<TerminationType, string> = { EXPIRED: "到期解约", NEGOTIATED: "协商解约", BREACH: "违约退租" };

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
  const [presetFees, setPresetFees] = useState<Array<{ type: BillItemType; amount: string }>>([]);
  const [customFees, setCustomFees] = useState<Array<{ id: string; name: string; amount: string }>>([]);
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
    if (!currentOrgId || !selectedRoom) return;
    if (!canManageLease) return Taro.showToast({ title: "当前角色没有管理租约权限", icon: "none" });
    if (selectedRoom.status !== "VACANT") return Taro.showToast({ title: "仅空闲房间可以签约", icon: "none" });
    if (!leaseForm.tenantName.trim() || !leaseForm.tenantPhone.trim() || !leaseForm.rentAmount.trim()) {
      return Taro.showToast({ title: "请填写租客、电话和租金", icon: "none" });
    }
    const fees = [
      ...presetFees.filter((item) => item.amount.trim()).map((item) => ({
        type: item.type,
        name: presetFeeTypes.find((p) => p.type === item.type)!.label,
        amount: Number(item.amount)
      })),
      ...customFees.filter((item) => item.name.trim() && item.amount.trim()).map((item) => ({
        name: item.name.trim(),
        amount: Number(item.amount)
      }))
    ];
    try {
      await apiClient("/leases", {
        method: "POST",
        body: {
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
        },
        organizationId: currentOrgId
      });
      Taro.showToast({ title: "签约完成", icon: "success" });
      setLeaseForm({ tenantName: "", tenantPhone: "", startDate: today(), endDate: nextYear(), graceDays: "0", cycle: "MONTHLY", rentAmount: "", depositAmount: "", waterUnitPrice: "0", powerUnitPrice: "0", autoRenew: true, generateHistoricalBills: false });
      setPresetFees([]);
      setCustomFees([]);
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
    const fees = [
      ...presetFees.filter((item) => item.amount.trim()).map((item) => ({
        type: item.type,
        name: presetFeeTypes.find((p) => p.type === item.type)!.label,
        amount: Number(item.amount)
      })),
      ...customFees.filter((item) => item.name.trim() && item.amount.trim()).map((item) => ({
        name: item.name.trim(),
        amount: Number(item.amount)
      }))
    ];
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
      setPresetFees([]);
      setCustomFees([]);
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

  if (!currentOrgId) {
    return <NoOrganization />;
  }

  return (
    <View className="page-container">
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
                <View className="detail-panel">
                  <View className="detail-row">
                    <Text className="text-muted">水电单价</Text>
                    <Text className="text-muted">水 ¥{money(room.apartment?.waterUnitPrice)} · 电 ¥{money(room.apartment?.powerUnitPrice)}</Text>
                  </View>
                </View>
                <View className="action-row-inline">
                  {canManageRoom ? <Button variant="secondary" size="small" onClick={() => {
                    setRoomForm({ roomNo: room.roomNo, layout: room.layout, area: room.area ? String(room.area) : "", facilities: room.facilities.join(","), status: room.status });
                    setEditingRoomId(room.id);
                  }}>编辑房间</Button> : null}
                  {room.status === "VACANT" && canManageLease ? <Button size="small" onClick={() => { setSelectedId(room.id); setLeaseRoomId(room.id); setEditingRoomId(undefined); }}>签约入住</Button> : null}
                  {canManageRoom ? (
                    <View onClick={(e) => { e.stopPropagation(); deleteRoom(); }}>
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
                          setPresetFees(fees.filter((fee) => presetFeeTypes.some((p) => p.type === fee.type)).map((fee) => ({ type: fee.type, amount: String(fee.amount) })));
                          setCustomFees(fees.filter((fee) => !presetFeeTypes.some((p) => p.type === fee.type)).map((fee) => ({ id: `${Date.now()}-${Math.random()}`, name: fee.name, amount: String(fee.amount) })));
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

      {/* Edit Room Panel */}
      {editingRoom && (
        <View className="form-panel">
          <Card title="编辑房间" subtitle={`${editingRoom.apartment?.name} · ${editingRoom.roomNo}`}>
            <Input placeholder="房间号" value={roomForm.roomNo} onInput={(e) => setRoomForm((old) => ({ ...old, roomNo: e.detail.value }))} />
            <View className="form-grid">
              <Input placeholder="户型" value={roomForm.layout} onInput={(e) => setRoomForm((old) => ({ ...old, layout: e.detail.value }))} />
              <Input placeholder="面积 ㎡" type="number" value={roomForm.area} onInput={(e) => setRoomForm((old) => ({ ...old, area: e.detail.value }))} />
            </View>
            <Input placeholder="设施，用逗号分隔" value={roomForm.facilities} onInput={(e) => setRoomForm((old) => ({ ...old, facilities: e.detail.value }))} />
            <View className="segment">
              {roomStatuses.map((item) => (
                <View key={item} className={`segment-item ${roomForm.status === item ? 'segment-item--active' : ''}`} onClick={() => setRoomForm((old) => ({ ...old, status: item }))}>
                  <Text className={`segment-text ${roomForm.status === item ? 'segment-text--active' : ''}`}>{statusLabels[item]}</Text>
                </View>
              ))}
            </View>
            <View className="action-row">
              <Button onClick={updateRoom}>保存房间信息</Button>
              <Button variant="ghost" onClick={() => setEditingRoomId(undefined)}>取消</Button>
            </View>
          </Card>
        </View>
      )}

      {/* Create Lease Panel */}
      {leaseRoom && (
        <View className="form-panel">
          <Card title="签约入住" subtitle={`${leaseRoom.apartment?.name} · ${leaseRoom.roomNo}`}>
            <Input placeholder="租客姓名" value={leaseForm.tenantName} onInput={(e) => setLeaseForm((old) => ({ ...old, tenantName: e.detail.value }))} />
            <Input placeholder="租客电话" value={leaseForm.tenantPhone} onInput={(e) => setLeaseForm((old) => ({ ...old, tenantPhone: e.detail.value }))} />
            <View className="form-grid">
              <Input placeholder="开始日期" value={leaseForm.startDate} onInput={(e) => setLeaseForm((old) => ({ ...old, startDate: e.detail.value }))} />
              <Input placeholder="结束日期" value={leaseForm.endDate} onInput={(e) => setLeaseForm((old) => ({ ...old, endDate: e.detail.value }))} />
            </View>
            <View className="form-grid">
              <Input placeholder="租金 每期金额" type="number" value={leaseForm.rentAmount} onInput={(e) => setLeaseForm((old) => ({ ...old, rentAmount: e.detail.value }))} />
              <Input placeholder="押金" type="number" value={leaseForm.depositAmount} onInput={(e) => setLeaseForm((old) => ({ ...old, depositAmount: e.detail.value }))} />
            </View>
            <View className="form-grid">
              <Input placeholder="交租日后几日内" type="number" value={leaseForm.graceDays} onInput={(e) => setLeaseForm((old) => ({ ...old, graceDays: e.detail.value }))} />
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
              <Input placeholder="水费单价" type="number" value={leaseForm.waterUnitPrice} onInput={(e) => setLeaseForm((old) => ({ ...old, waterUnitPrice: e.detail.value }))} />
              <Input placeholder="电费单价" type="number" value={leaseForm.powerUnitPrice} onInput={(e) => setLeaseForm((old) => ({ ...old, powerUnitPrice: e.detail.value }))} />
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
            {presetFeeTypes.map(({ type, label }) => {
              const selected = presetFees.find((item) => item.type === type);
              return (
                <View key={type} style={{ marginBottom: 8 }}>
                  <View className={`fee-card ${selected ? 'fee-card--active' : ''}`} onClick={() => togglePresetFee(type)}>
                    <Text className={selected ? "card-title" : "text-muted"}>{label}</Text>
                    <Text className={selected ? "card-stat" : "text-muted"}>{selected ? `¥${money(selected.amount)}` : "点击添加"}</Text>
                  </View>
                  {selected ? <Input placeholder="输入金额" type="number" value={selected.amount} onInput={(e) => updatePresetFeeAmount(type, e.detail.value)} /> : null}
                </View>
              );
            })}
            {customFees.length > 0 ? <Text className="field-label">其他费用</Text> : null}
            {customFees.map((item, index) => (
              <View key={item.id} className="custom-fee-row">
                <Input placeholder="费用名称" value={item.name} onInput={(e) => setCustomFees((old) => old.map((f, i) => (i === index ? { ...f, name: e.detail.value } : f)))} />
                <Input placeholder="金额" type="number" value={item.amount} onInput={(e) => setCustomFees((old) => old.map((f, i) => (i === index ? { ...f, amount: e.detail.value } : f)))} />
                <Text className="danger-text" onClick={() => setCustomFees((old) => old.filter((_, i) => i !== index))}>删除</Text>
              </View>
            ))}
            <Button variant="secondary" size="small" onClick={() => setCustomFees((old) => [...old, { id: `${Date.now()}-${old.length}`, name: "", amount: "" }])}>添加其他费用</Button>
            <View className="action-row">
              <Button onClick={createLease}>确认签约</Button>
              <Button variant="ghost" onClick={() => { setLeaseRoomId(undefined); setPresetFees([]); setCustomFees([]); }}>取消</Button>
            </View>
          </Card>
        </View>
      )}

      {/* Edit Lease Panel */}
      {editingLease && (
        <View className="form-panel">
          <Card title="编辑租约" subtitle={`${editingLease.tenantName} · ${editingLease.room?.apartment?.name} · ${editingLease.room?.roomNo}`}>
            <View className="form-grid">
              <Input placeholder="租金 每期金额" type="number" value={editLeaseForm.rentAmount} onInput={(e) => setEditLeaseForm((old) => ({ ...old, rentAmount: e.detail.value }))} />
              <Input placeholder="押金" type="number" value={editLeaseForm.depositAmount} onInput={(e) => setEditLeaseForm((old) => ({ ...old, depositAmount: e.detail.value }))} />
            </View>
            <View className="form-grid">
              <Input placeholder="水费单价" type="number" value={editLeaseForm.waterUnitPrice} onInput={(e) => setEditLeaseForm((old) => ({ ...old, waterUnitPrice: e.detail.value }))} />
              <Input placeholder="电费单价" type="number" value={editLeaseForm.powerUnitPrice} onInput={(e) => setEditLeaseForm((old) => ({ ...old, powerUnitPrice: e.detail.value }))} />
            </View>
            <Text className="field-label">费用项目</Text>
            {presetFeeTypes.map(({ type, label }) => {
              const selected = presetFees.find((item) => item.type === type);
              return (
                <View key={type} style={{ marginBottom: 8 }}>
                  <View className={`fee-card ${selected ? 'fee-card--active' : ''}`} onClick={() => togglePresetFee(type)}>
                    <Text className={selected ? "card-title" : "text-muted"}>{label}</Text>
                    <Text className={selected ? "card-stat" : "text-muted"}>{selected ? `¥${money(selected.amount)}` : "点击添加"}</Text>
                  </View>
                  {selected ? <Input placeholder="输入金额" type="number" value={selected.amount} onInput={(e) => updatePresetFeeAmount(type, e.detail.value)} /> : null}
                </View>
              );
            })}
            {customFees.length > 0 ? <Text className="field-label">其他费用</Text> : null}
            {customFees.map((item, index) => (
              <View key={item.id} className="custom-fee-row">
                <Input placeholder="费用名称" value={item.name} onInput={(e) => setCustomFees((old) => old.map((f, i) => (i === index ? { ...f, name: e.detail.value } : f)))} />
                <Input placeholder="金额" type="number" value={item.amount} onInput={(e) => setCustomFees((old) => old.map((f, i) => (i === index ? { ...f, amount: e.detail.value } : f)))} />
                <Text className="danger-text" onClick={() => setCustomFees((old) => old.filter((_, i) => i !== index))}>删除</Text>
              </View>
            ))}
            <Button variant="secondary" size="small" onClick={() => setCustomFees((old) => [...old, { id: `${Date.now()}-${old.length}`, name: "", amount: "" }])}>添加其他费用</Button>
            <View className="action-row">
              <Button onClick={updateLease}>保存修改</Button>
              <Button variant="ghost" onClick={() => { setEditingLease(undefined); setPresetFees([]); setCustomFees([]); }}>取消</Button>
            </View>
          </Card>
        </View>
      )}

      {/* Termination Panel */}
      {terminatingLease && (
        <View className="form-panel">
          <Card title="合约终止" subtitle={`${terminatingLease.tenantName} · ${terminatingLease.startDate.slice(0, 10)} 至 ${terminatingLease.endDate.slice(0, 10)}`}>
            <View className="segment">
              {(["EXPIRED", "NEGOTIATED", "BREACH"] as TerminationType[]).map((item) => (
                <View key={item} className={`segment-item ${terminationForm.type === item ? 'segment-item--active' : ''}`} onClick={() => setTerminationForm((old) => ({ ...old, type: item }))}>
                  <Text className={`segment-text ${terminationForm.type === item ? 'segment-text--active' : ''}`}>{terminationLabels[item]}</Text>
                </View>
              ))}
            </View>
            <Text className="field-label">退租日期</Text>
            <Input placeholder="YYYY-MM-DD" value={terminationForm.terminatedAt} onInput={(e) => setTerminationForm((old) => ({ ...old, terminatedAt: e.detail.value }))} />
            <View className="detail-panel">
              <View className="detail-row"><Text className="text-muted">原押金</Text><Text className="card-stat">¥{money(terminatingLease.depositAmount)}</Text></View>
              <View className="detail-row"><Text className="text-muted">预计退押金</Text><Text className="card-stat">¥{money(settlementPreview.depositRefund)}</Text></View>
            </View>
            <View className="form-grid">
              <Input placeholder="押金扣款" type="number" value={terminationForm.depositDeductionAmount} onInput={(e) => setTerminationForm((old) => ({ ...old, depositDeductionAmount: e.detail.value }))} />
              <Input placeholder="房租退补" type="number" value={terminationForm.rentAdjustmentAmount} onInput={(e) => setTerminationForm((old) => ({ ...old, rentAdjustmentAmount: e.detail.value }))} />
            </View>
            <Input placeholder="押金扣款原因" value={terminationForm.depositDeductionReason} onInput={(e) => setTerminationForm((old) => ({ ...old, depositDeductionReason: e.detail.value }))} />
            <View className="form-grid">
              <View>
                <Text className="field-label">退租水表读数</Text>
                <Input placeholder="当前读数" type="number" value={terminationForm.currentWater} onInput={(e) => setTerminationForm((old) => ({ ...old, currentWater: e.detail.value }))} />
                <Text className="text-muted">上次 {money(previousReadings.previousWater)}</Text>
              </View>
              <View>
                <Text className="field-label">退租电表读数</Text>
                <Input placeholder="当前读数" type="number" value={terminationForm.currentPower} onInput={(e) => setTerminationForm((old) => ({ ...old, currentPower: e.detail.value }))} />
                <Text className="text-muted">上次 {money(previousReadings.previousPower)}</Text>
              </View>
            </View>
            <View className="form-grid">
              <Input placeholder="其他费用" type="number" value={terminationForm.otherFeeAmount} onInput={(e) => setTerminationForm((old) => ({ ...old, otherFeeAmount: e.detail.value }))} />
              <View>
                <Text className="field-label">预估水电费</Text>
                <Text className="card-stat">¥{money(settlementPreview.utility)}</Text>
              </View>
            </View>
            <Input placeholder="其他费用说明" value={terminationForm.otherFeeReason} onInput={(e) => setTerminationForm((old) => ({ ...old, otherFeeReason: e.detail.value }))} />
            <View className="detail-panel">
              <View className="detail-row"><Text className="text-muted">应收</Text><Text className="card-stat">¥{money(settlementPreview.receivable)}</Text></View>
              <View className="detail-row"><Text className="text-muted">应退</Text><Text className="card-stat">¥{money(settlementPreview.refundable)}</Text></View>
              <View className="detail-row"><Text className="text-muted">结算结果</Text>
                <Text className={settlementPreview.net >= 0 ? "card-stat" : "danger-text"}>
                  {settlementPreview.net > 0 ? `租客补交 ¥${money(settlementPreview.net)}` : settlementPreview.net < 0 ? `退租客 ¥${money(Math.abs(settlementPreview.net))}` : "结清"}
                </Text>
              </View>
            </View>
            <Input placeholder="原因（可选）" value={terminationForm.reason} onInput={(e) => setTerminationForm((old) => ({ ...old, reason: e.detail.value }))} />
            {terminatingLease?.isAutoRenewalPeriod ? <Text className="text-muted">当前租约已进入自动续约期，到期后退房不默认视为违约。</Text> : null}
            <View className="action-row">
              <Button variant="danger" onClick={terminateLease}>确认终止合约</Button>
              <Button variant="ghost" onClick={() => setTerminatingLease(undefined)}>取消</Button>
            </View>
          </Card>
        </View>
      )}
    </View>
  );
}
