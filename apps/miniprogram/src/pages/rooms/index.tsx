import { useState, useMemo, useCallback } from 'react';
import { View } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import {
  useAppSession,
  useHasPermission,
} from '../../context/AppSessionContext';
import { getRooms, deleteRoom } from '../../api/rooms';
import { NoOrganization } from '../../components/NoOrganization';
import { RoomList } from './components/RoomList';
import type { Room } from '../../types/domain';
import './index.scss';

export default function RoomsPage() {
  const { currentOrgId } = useAppSession();
  const canManageRoom = useHasPermission('room:manage');
  const canManageLease = useHasPermission('lease:manage');

  const [rooms, setRooms] = useState<Room[]>([]);
  const [filter, setFilter] = useState<
    'ALL' | 'VACANT' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE'
  >('ALL');
  const [selectedId, setSelectedId] = useState<string>();

  const vacantCount = rooms.filter((item) => item.status === 'VACANT').length;
  const occupiedCount = rooms.filter(
    (item) => item.status === 'OCCUPIED'
  ).length;

  const loadRooms = useCallback(async () => {
    if (!currentOrgId) return;
    try {
      const data = await getRooms(currentOrgId);
      setRooms(data);
      setSelectedId((old) =>
        old && data.some((item) => item.id === old) ? old : undefined
      );
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '加载失败',
        icon: 'none',
      });
    }
  }, [currentOrgId]);

  useDidShow(() => {
    loadRooms();
  });

  usePullDownRefresh(() => {
    loadRooms().finally(() => Taro.stopPullDownRefresh());
  });

  const handleFilterChange = (
    nextFilter: 'ALL' | 'VACANT' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE'
  ) => {
    setFilter(nextFilter);
    setSelectedId(undefined);
  };

  const handleSelectRoom = (id: string) => {
    Taro.navigateTo({ url: `/pages/rooms/detail?id=${id}` });
  };

  const handleDeleteRoom = (room: Room) => {
    if (!currentOrgId) return;
    if (!canManageRoom)
      return Taro.showToast({
        title: '当前角色没有管理房间权限',
        icon: 'none',
      });
    if (room.status === 'OCCUPIED')
      return Taro.showToast({
        title: '已租房间不能删除，请先退租',
        icon: 'none',
      });
    Taro.showModal({
      title: '删除房间',
      content: '删除后房间资料不可恢复，请确认当前房间没有有效租约。',
      confirmText: '确认删除',
      confirmColor: '#c2413d',
    }).then(async (res) => {
      if (!res.confirm) return;
      try {
        await deleteRoom(currentOrgId, room.id);
        Taro.showToast({ title: '房间已删除', icon: 'success' });
        setSelectedId(undefined);
        await loadRooms();
      } catch (e) {
        Taro.showToast({
          title: e instanceof Error ? e.message : '删除房间失败',
          icon: 'none',
        });
      }
    });
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
        onDeleteRoom={handleDeleteRoom}
      />
    </View>
  );
}
