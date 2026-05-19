import { useState, useMemo, useCallback } from 'react';
import { View } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { useAppSession, useHasPermission } from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { NoOrganization } from '../../components/NoOrganization';
import { RoomList } from './components/RoomList';
import { EditRoomSheet } from './components/EditRoomSheet';
import { LeaseSheet } from './components/LeaseSheet';
import { EditLeaseSheet } from './components/EditLeaseSheet';
import { TerminationSheet } from './components/TerminationSheet';
import { emptyRoomForm, emptyLeaseForm, emptyEditLeaseForm, type LeaseFeeFormItem } from './constants';
import { buildLeaseFeesPayload, terminationResultText } from './utils';
import { today, nextYear } from '../../utils/format';
import type { Room, RoomStatus, Lease, TerminationType } from '../../types/domain';
import './index.scss';

export default function RoomsPage() {
  const { currentOrgId } = useAppSession();
  const canManageRoom = useHasPermission("room:manage");
  const canManageLease = useHasPermission("lease:manage");

  const [rooms, setRooms] = useState<Room[]>([]);
  const [filter, setFilter] = useState<RoomStatus | "ALL">("ALL");
  const [selectedId, setSelectedId] = useState<string>();
  const [layer, setLayer] = useState<"editRoom" | "lease" | "editLease" | "termination" | undefined>();
  const [roomForm, setRoomForm] = useState(emptyRoomForm);
  const [leaseForm, setLeaseForm] = useState(emptyLeaseForm);
  const [editLeaseForm, setEditLeaseForm] = useState(emptyEditLeaseForm);
  const [terminatingLease, setTerminatingLease] = useState<Lease>();

  const selectedRoom = useMemo(() => rooms.find((item) => item.id === selectedId), [rooms, selectedId]);
  const selectedRoomLease = useMemo(() => selectedRoom?.leases?.find((item) => item.status === "ACTIVE"), [selectedRoom]);
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

  const resetLayer = () => setLayer(undefined);

  const handleFilterChange = (nextFilter: RoomStatus | "ALL") => {
    setFilter(nextFilter);
    setSelectedId(undefined);
    setLayer(undefined);
  };

  const handleSelectRoom = (id: string) => {
    setSelectedId(selectedId === id ? undefined : id);
    setLayer(undefined);
  };

  const handleEditRoom = (room: Room) => {
    setRoomForm({ roomNo: room.roomNo, layout: room.layout, area: room.area ? String(room.area) : "", facilities: room.facilities.join(","), status: room.status });
    setLayer("editRoom");
  };

  const handleDeleteRoom = (room: Room) => {
    if (!currentOrgId) return;
    if (!canManageRoom) return Taro.showToast({ title: "当前角色没有管理房间权限", icon: "none" });
    if (room.status === "OCCUPIED") return Taro.showToast({ title: "已租房间不能删除，请先退租", icon: "none" });
    Taro.showModal({
      title: "删除房间",
      content: "删除后房间资料不可恢复，请确认当前房间没有有效租约。",
      confirmText: "确认删除",
      confirmColor: "#c2413d"
    }).then(async (res) => {
      if (!res.confirm) return;
      try {
        await apiClient(`/apartments/rooms/${room.id}`, { method: "DELETE", organizationId: currentOrgId });
        Taro.showToast({ title: "房间已删除", icon: "success" });
        setSelectedId(undefined);
        await loadRooms();
      } catch (e) {
        Taro.showToast({ title: e instanceof Error ? e.message : "删除房间失败", icon: "none" });
      }
    });
  };

  const handleLeaseRoom = (roomId: string) => {
    setSelectedId(roomId);
    setLeaseForm({ ...emptyLeaseForm, startDate: today(), endDate: nextYear() });
    setLayer("lease");
  };

  const handleEditLease = (room: Room) => {
    const lease = room.leases?.find((item) => item.status === "ACTIVE");
    if (!lease) return;
    setEditLeaseForm({
      rentAmount: String(lease.rentAmount ?? ""),
      depositAmount: String(lease.depositAmount ?? ""),
      waterUnitPrice: String(lease.waterUnitPrice ?? 0),
      powerUnitPrice: String(lease.powerUnitPrice ?? 0)
    });
    setLayer("editLease");
  };

  const handleTerminateLease = (room: Room) => {
    const lease = room.leases?.find((item) => item.status === "ACTIVE");
    if (lease) setTerminatingLease(lease);
  };

  const updateRoom = async () => {
    if (!currentOrgId || !selectedRoom) return;
    if (!canManageRoom) return Taro.showToast({ title: "当前角色没有管理房间权限", icon: "none" });
    try {
      await apiClient(`/apartments/rooms/${selectedRoom.id}`, {
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
      resetLayer();
      await loadRooms();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "保存房间失败", icon: "none" });
    }
  };

  const createLease = async (fees: LeaseFeeFormItem[]) => {
    if (!currentOrgId || !selectedRoom) return;
    if (!canManageLease) return Taro.showToast({ title: "当前角色没有管理租约权限", icon: "none" });
    if (selectedRoom.status !== "VACANT") return Taro.showToast({ title: "仅空闲房间可以签约", icon: "none" });
    if (!leaseForm.tenantName.trim() || !leaseForm.tenantPhone.trim() || !leaseForm.rentAmount.trim()) {
      return Taro.showToast({ title: "请填写租客、电话和租金", icon: "none" });
    }
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
          fees: buildLeaseFeesPayload(fees)
        },
        organizationId: currentOrgId
      });
      Taro.showToast({ title: "签约完成", icon: "success" });
      resetLayer();
      setSelectedId(undefined);
      await loadRooms();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "签约失败", icon: "none" });
    }
  };

  const updateLease = async (fees: LeaseFeeFormItem[]) => {
    if (!currentOrgId || !selectedRoomLease) return;
    if (!canManageLease) return Taro.showToast({ title: "当前角色没有管理租约权限", icon: "none" });
    try {
      await apiClient(`/leases/${selectedRoomLease.id}`, {
        method: "PUT",
        body: {
          rentAmount: editLeaseForm.rentAmount.trim() ? Number(editLeaseForm.rentAmount) : undefined,
          depositAmount: editLeaseForm.depositAmount.trim() ? Number(editLeaseForm.depositAmount) : undefined,
          waterUnitPrice: Number(editLeaseForm.waterUnitPrice || 0),
          powerUnitPrice: Number(editLeaseForm.powerUnitPrice || 0),
          fees: buildLeaseFeesPayload(fees)
        },
        organizationId: currentOrgId
      });
      Taro.showToast({ title: "租约信息已更新", icon: "success" });
      resetLayer();
      await loadRooms();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "更新租约失败", icon: "none" });
    }
  };

  const terminateLease = async (payload: {
    type: TerminationType;
    reason: string;
    terminatedAt: string;
    depositDeductionAmount: number;
    depositDeductionReason?: string;
    rentAdjustmentAmount: number;
    currentWater: number;
    currentPower: number;
    otherFeeAmount: number;
    otherFeeReason?: string;
  }) => {
    if (!currentOrgId || !terminatingLease) return;
    if (!canManageLease) return Taro.showToast({ title: "当前角色没有管理租约权限", icon: "none" });
    try {
      const settlement = await apiClient(`/leases/${terminatingLease.id}/terminate`, {
        method: "POST",
        body: payload,
        organizationId: currentOrgId
      });
      const net = Number((settlement as { netAmount: string | number }).netAmount);
      Taro.showToast({ title: terminationResultText(net), icon: "success" });
      setTerminatingLease(undefined);
      setSelectedId(undefined);
      await loadRooms();
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : "退租失败", icon: "none" });
    }
  };

  if (!currentOrgId) {
    return <NoOrganization />;
  }

  return (
    <View className="page-container">
      <RoomList
        rooms={rooms}
        filter={filter}
        vacantCount={vacantCount}
        occupiedCount={occupiedCount}
        selectedId={selectedId}
        canManageRoom={canManageRoom}
        canManageLease={canManageLease}
        onFilterChange={handleFilterChange}
        onSelectRoom={handleSelectRoom}
        onEditRoom={handleEditRoom}
        onDeleteRoom={handleDeleteRoom}
        onLeaseRoom={handleLeaseRoom}
        onEditLease={handleEditLease}
        onTerminateLease={handleTerminateLease}
      />

      <EditRoomSheet
        visible={layer === "editRoom"}
        room={selectedRoom}
        form={roomForm}
        onUpdateForm={(key, value) => setRoomForm((old) => ({ ...old, [key]: value }))}
        onSave={updateRoom}
        onClose={resetLayer}
      />

      <LeaseSheet
        visible={layer === "lease"}
        form={leaseForm}
        onUpdateForm={(key, value) => setLeaseForm((old) => ({ ...old, [key]: value }))}
        onSubmit={createLease}
        onClose={resetLayer}
      />

      <EditLeaseSheet
        visible={layer === "editLease"}
        lease={selectedRoomLease}
        form={editLeaseForm}
        onUpdateForm={(key, value) => setEditLeaseForm((old) => ({ ...old, [key]: value }))}
        onSubmit={updateLease}
        onClose={resetLayer}
      />

      <TerminationSheet
        visible={layer === "termination"}
        lease={terminatingLease}
        currentOrgId={currentOrgId}
        onSubmit={terminateLease}
        onClose={() => setTerminatingLease(undefined)}
      />
    </View>
  );
}
