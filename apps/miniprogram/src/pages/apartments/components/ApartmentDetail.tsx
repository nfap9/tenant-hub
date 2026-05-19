import { ScrollView, View, Text } from '@tarojs/components';
import { Button, Card, Badge } from '../../../components/ui';
import { money, facilitiesText } from '../../../utils/format';
import { contractText } from '../utils';
import { toneForStatus, statusLabels } from '../constants';
import type { Apartment, Room } from '../../../types/domain';

interface ApartmentDetailProps {
  selectedApartment: Apartment;
  apartmentRooms: Room[];
  detailTab: "expenses" | "rooms";
  canManageApartment: boolean;
  canManageRoom: boolean;
  editingRoomId?: string;
  deleteRoomId?: string;
  onBack: () => void;
  onEdit: () => void;
  onDeleteApartment: () => void;
  onChangeTab: (tab: "expenses" | "rooms") => void;
  onRecordExpense: () => void;
  onOpenRoomSingle: () => void;
  onOpenRoomBatch: () => void;
  onOpenRoomEdit: (room: Room) => void;
  onOpenRoomDelete: (room: Room) => void;
}

export function ApartmentDetail({
  selectedApartment,
  apartmentRooms,
  detailTab,
  canManageApartment,
  canManageRoom,
  editingRoomId,
  deleteRoomId,
  onBack,
  onEdit,
  onDeleteApartment,
  onChangeTab,
  onRecordExpense,
  onOpenRoomSingle,
  onOpenRoomBatch,
  onOpenRoomEdit,
  onOpenRoomDelete
}: ApartmentDetailProps) {
  const apartmentVacantRooms = apartmentRooms.filter((room) => room.status === "VACANT").length;
  const apartmentOccupiedRooms = apartmentRooms.filter((room) => room.status === "OCCUPIED").length;

  return (
    <View className="page-container page-container--apartment-detail">
      <View className="apartment-detail-fixed">
        <View className="sub-page-header">
          <Button className="page-back-button" variant="ghost" size="small" onClick={onBack}>‹ 返回公寓列表</Button>
        </View>

        <Card
          className="apartment-detail-summary"
          title={selectedApartment.name}
          subtitle={selectedApartment.location}
          headerAction={canManageApartment ? (
            <View className="action-row-inline">
              <Button variant="secondary" size="small" onClick={onEdit}>编辑</Button>
              <Button variant="danger" size="small" onClick={onDeleteApartment}>删除</Button>
            </View>
          ) : undefined}
        >
          <View className="segment">
            <View className={`segment-item ${detailTab === "expenses" ? "segment-item--active" : ""}`} onClick={() => onChangeTab("expenses")}>
              <Text className={`segment-text ${detailTab === "expenses" ? "segment-text--active" : ""}`}>公寓详情</Text>
            </View>
            <View className={`segment-item ${detailTab === "rooms" ? "segment-item--active" : ""}`} onClick={() => onChangeTab("rooms")}>
              <Text className={`segment-text ${detailTab === "rooms" ? "segment-text--active" : ""}`}>房间列表</Text>
            </View>
          </View>
        </Card>
      </View>

      {detailTab === "expenses" ? (
        <View className="apartment-detail-content">
          <Card className="apartment-info-card">
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
                <Text className="text-muted">房间数量</Text>
                <Text className="card-stat">{selectedApartment.rooms?.length ?? 0} 间</Text>
              </View>
            </View>
          </Card>

          <Card
            className="apartment-tab-card"
            title="经营花费"
            subtitle="每月经营支出从这里快速记录"
            headerAction={canManageApartment ? <Button variant="secondary" size="small" onClick={onRecordExpense}>记录花费</Button> : undefined}
          >
            <ScrollView className="apartment-inner-list" scrollY>
              {(selectedApartment.expenses ?? []).map((item) => (
                <View className="detail-row expense-list-row" key={item.id}>
                  <Text className="text-muted">{item.name} · {item.spentAt.slice(0, 10)}</Text>
                  <Text className="card-stat">¥{money(item.amount)}</Text>
                </View>
              ))}
              {(selectedApartment.expenses ?? []).length === 0 ? <Text className="text-muted">暂无经营花费记录</Text> : null}
            </ScrollView>
          </Card>
        </View>
      ) : null}

      {detailTab === "rooms" ? (
        <Card
          className="apartment-tab-card"
          title="房间列表"
          subtitle={`共 ${apartmentRooms.length} 间 · 空闲 ${apartmentVacantRooms} 间 · 已租 ${apartmentOccupiedRooms} 间`}
          headerAction={canManageRoom ? (
            <View className="action-row-inline">
              <Button variant="secondary" size="small" onClick={onOpenRoomSingle}>新增房间</Button>
              <Button variant="secondary" size="small" onClick={onOpenRoomBatch}>批量添加</Button>
            </View>
          ) : undefined}
        >
          <ScrollView className="apartment-inner-list" scrollY>
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
                    <Button variant="secondary" size="small" onClick={() => onOpenRoomEdit(room)}>编辑</Button>
                    <Button variant="danger" size="small" disabled={room.status === "OCCUPIED"} onClick={() => onOpenRoomDelete(room)}>删除</Button>
                  </View>
                ) : null}
              </View>
            ))}
            {apartmentRooms.length === 0 ? <Text className="text-muted">暂无房间，可以新增单个房间或批量添加</Text> : null}
          </ScrollView>
        </Card>
      ) : null}
    </View>
  );
}
