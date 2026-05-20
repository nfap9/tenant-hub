import { ScrollView, View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Button, Card, EmptyState, Badge } from '../../../components/ui';
import { money } from '../../../utils/format';
import { statusLabels, toneForStatus, filters, cycleLabels } from '../constants';
import type { Room, RoomStatus } from '../../../types/domain';

interface RoomListProps {
  rooms: Room[];
  filter: RoomStatus | "ALL";
  vacantCount: number;
  occupiedCount: number;
  selectedId?: string;
  canManageRoom: boolean;
  canManageLease: boolean;
  onFilterChange: (filter: RoomStatus | "ALL") => void;
  onSelectRoom: (id: string) => void;
  onDeleteRoom: (room: Room) => void;
}

export function RoomList({
  rooms, filter, vacantCount, occupiedCount, selectedId,
  canManageRoom, canManageLease,
  onFilterChange, onSelectRoom, onDeleteRoom
}: RoomListProps) {
  const visibleRooms = filter === "ALL" ? rooms : rooms.filter((item) => item.status === filter);

  return (
    <>
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
            <Button key={item} variant={filter === item ? "primary" : "ghost"} size="small" onClick={() => onFilterChange(item)}>
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
            <View key={room.id} className={`room-card ${expanded ? 'room-card--active' : ''}`} onClick={() => onSelectRoom(room.id)}>
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
                    {canManageRoom ? <View onClick={(e) => e.stopPropagation()}><Button variant="secondary" size="small" onClick={() => Taro.navigateTo({ url: `/pages/rooms/room-form?roomId=${room.id}` })}>编辑房间</Button></View> : null}
                    {room.status === "VACANT" && canManageLease ? <View onClick={(e) => e.stopPropagation()}><Button size="small" onClick={() => Taro.navigateTo({ url: `/pages/rooms/lease-form?roomId=${room.id}` })}>签约入住</Button></View> : null}
                    {canManageRoom ? <View onClick={(e) => e.stopPropagation()}><Button variant="danger" size="small" onClick={() => onDeleteRoom(room)}>删除房间</Button></View> : null}
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
                          <View onClick={(e) => e.stopPropagation()}><Button variant="secondary" size="small" onClick={() => Taro.navigateTo({ url: `/pages/rooms/lease-edit?roomId=${room.id}` })}>编辑租约</Button></View>
                          <View onClick={(e) => e.stopPropagation()}><Button variant="danger" size="small" onClick={() => Taro.navigateTo({ url: `/pages/rooms/lease-terminate?roomId=${room.id}` })}>退租</Button></View>
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
    </>
  );
}
