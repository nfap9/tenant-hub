import { useState, useMemo, useCallback } from 'react';
import { ScrollView, View, Text } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import {
  useAppSession,
  useHasPermission,
} from '../../context/AppSessionContext';
import { getApartments, deleteApartment } from '../../api/apartments';
import { deleteRoom } from '../../api/rooms';
import { Button, Card, Badge } from '../../components/ui';
import { money, facilitiesText } from '../../utils/format';
import { contractText } from './utils';
import { toneForStatus, statusLabels } from './constants';
import type { Apartment, Room } from '../../types/domain';
import './index.scss';

export default function ApartmentDetailPage() {
  const { currentOrgId } = useAppSession();
  const canManageApartment = useHasPermission('apartment:manage');
  const canManageRoom = useHasPermission('room:manage');
  const { params } = useRouter();
  const apartmentId = params.id;

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [detailTab, setDetailTab] = useState<'expenses' | 'rooms'>('expenses');

  const loadApartments = useCallback(async () => {
    if (!currentOrgId) return;
    try {
      const data = await getApartments(currentOrgId);
      setApartments(data);
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '加载失败',
        icon: 'none',
      });
    }
  }, [currentOrgId]);

  useDidShow(() => {
    loadApartments();
  });

  const apartment = useMemo(
    () => apartments.find((a) => a.id === apartmentId),
    [apartments, apartmentId]
  );
  const apartmentRooms = useMemo(
    () =>
      [...(apartment?.rooms ?? [])].sort((left, right) =>
        left.roomNo.localeCompare(right.roomNo, 'zh-Hans-CN')
      ),
    [apartment]
  );

  const apartmentVacantRooms = useMemo(
    () => apartmentRooms.filter((room) => room.status === 'VACANT').length,
    [apartmentRooms]
  );
  const apartmentOccupiedRooms = useMemo(
    () => apartmentRooms.filter((room) => room.status === 'OCCUPIED').length,
    [apartmentRooms]
  );

  const handleBack = () => {
    Taro.navigateBack();
  };

  const handleEdit = () => {
    if (apartment) {
      Taro.navigateTo({ url: `/pages/apartments/form?id=${apartment.id}` });
    }
  };

  const handleDeleteApartment = async () => {
    if (!apartment || !currentOrgId) return;
    const res = await Taro.showModal({
      title: '删除公寓',
      content:
        '删除后公寓及下属所有房间资料不可恢复，请确认当前公寓没有有效租约。',
      confirmText: '确认删除',
      confirmColor: '#ff4d4f',
    });
    if (!res.confirm) return;

    try {
      await deleteApartment(currentOrgId, apartment.id);
      Taro.showToast({ title: '公寓已删除', icon: 'success' });
      Taro.navigateBack();
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '删除公寓失败',
        icon: 'none',
      });
    }
  };

  const handleRecordExpense = () => {
    if (apartment) {
      Taro.navigateTo({
        url: `/pages/apartments/expense?apartmentId=${apartment.id}`,
      });
    }
  };

  const handleOpenRoomSingle = () => {
    if (apartment) {
      Taro.navigateTo({
        url: `/pages/apartments/room-form?apartmentId=${apartment.id}`,
      });
    }
  };

  const handleOpenRoomBatch = () => {
    if (apartment) {
      Taro.navigateTo({
        url: `/pages/apartments/room-batch?apartmentId=${apartment.id}`,
      });
    }
  };

  const handleOpenRoomEdit = (room: Room) => {
    if (apartment) {
      Taro.navigateTo({
        url: `/pages/apartments/room-form?apartmentId=${apartment.id}&roomId=${room.id}`,
      });
    }
  };

  const handleDeleteRoom = async (room: Room) => {
    if (!currentOrgId) return;
    if (room.status === 'OCCUPIED') {
      Taro.showToast({ title: '已租房间不能删除，请先退租', icon: 'none' });
      return;
    }
    const res = await Taro.showModal({
      title: '删除房间',
      content: '删除后房间资料不可恢复，请确认当前房间没有有效租约。',
      confirmText: '确认删除',
      confirmColor: '#ff4d4f',
    });
    if (!res.confirm) return;

    try {
      await deleteRoom(currentOrgId, room.id);
      Taro.showToast({ title: '房间已删除', icon: 'success' });
      await loadApartments();
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '删除房间失败',
        icon: 'none',
      });
    }
  };

  if (!apartment) {
    return (
      <View className="page-container">
        <Text className="text-muted">公寓不存在或已删除</Text>
      </View>
    );
  }

  return (
    <View className="page-container page-container--apartment-detail">
      <View className="apartment-detail-fixed">
        <View className="sub-page-header">
          <Button
            className="page-back-button"
            variant="ghost"
            size="small"
            onClick={handleBack}
          >
            ‹ 返回公寓列表
          </Button>
        </View>

        <Card
          className="apartment-detail-summary"
          title={apartment.name}
          subtitle={apartment.location}
          headerAction={
            canManageApartment ? (
              <View className="action-row-inline">
                <Button variant="secondary" size="small" onClick={handleEdit}>
                  编辑
                </Button>
                <Button
                  variant="danger"
                  size="small"
                  onClick={handleDeleteApartment}
                >
                  删除
                </Button>
              </View>
            ) : undefined
          }
        >
          <View className="segment">
            <View
              className={`segment-item ${detailTab === 'expenses' ? 'segment-item--active' : ''}`}
              onClick={() => setDetailTab('expenses')}
            >
              <Text
                className={`segment-text ${detailTab === 'expenses' ? 'segment-text--active' : ''}`}
              >
                公寓详情
              </Text>
            </View>
            <View
              className={`segment-item ${detailTab === 'rooms' ? 'segment-item--active' : ''}`}
              onClick={() => setDetailTab('rooms')}
            >
              <Text
                className={`segment-text ${detailTab === 'rooms' ? 'segment-text--active' : ''}`}
              >
                房间列表
              </Text>
            </View>
          </View>
        </Card>
      </View>

      {detailTab === 'expenses' ? (
        <View className="apartment-detail-content">
          <Card className="apartment-info-card">
            <View className="detail-panel">
              <View className="detail-row">
                <Text className="text-muted">楼层/面积</Text>
                <Text className="card-title">
                  {apartment.contract?.floors || '未填'} 层 · 占地{' '}
                  {apartment.contract?.landArea ?? '未填'}㎡ · 总{' '}
                  {apartment.contract?.totalArea ?? '未填'}㎡
                </Text>
              </View>
              <View className="detail-row">
                <Text className="text-muted">上游房东</Text>
                <Text className="card-title">
                  {apartment.contract?.landlordName || '未维护'} ·{' '}
                  {apartment.contract?.landlordPhone || '未维护'}
                </Text>
              </View>
              <View className="detail-row">
                <Text className="text-muted">合同期</Text>
                <Text className="text-muted">
                  {contractText(apartment.contract)}
                </Text>
              </View>
              <View className="detail-row">
                <Text className="text-muted">上游租金</Text>
                <Text className="card-stat">
                  ¥{money(apartment.contract?.rentAmount)}
                </Text>
              </View>
              <View className="detail-row">
                <Text className="text-muted">房间数量</Text>
                <Text className="card-stat">
                  {apartment.rooms?.length ?? 0} 间
                </Text>
              </View>
            </View>
          </Card>

          <Card
            className="apartment-tab-card"
            title="经营花费"
            subtitle="每月经营支出从这里快速记录"
            headerAction={
              canManageApartment ? (
                <Button
                  variant="secondary"
                  size="small"
                  onClick={handleRecordExpense}
                >
                  记录花费
                </Button>
              ) : undefined
            }
          >
            <ScrollView className="apartment-inner-list" scrollY>
              {(apartment.expenses ?? []).map((item) => (
                <View className="detail-row expense-list-row" key={item.id}>
                  <Text className="text-muted">
                    {item.name} · {item.spentAt.slice(0, 10)}
                  </Text>
                  <Text className="card-stat">¥{money(item.amount)}</Text>
                </View>
              ))}
              {(apartment.expenses ?? []).length === 0 ? (
                <Text className="text-muted">暂无经营花费记录</Text>
              ) : null}
            </ScrollView>
          </Card>
        </View>
      ) : null}

      {detailTab === 'rooms' ? (
        <Card
          className="apartment-tab-card"
          title="房间列表"
          subtitle={`共 ${apartmentRooms.length} 间 · 空闲 ${apartmentVacantRooms} 间 · 已租 ${apartmentOccupiedRooms} 间`}
          headerAction={
            canManageRoom ? (
              <View className="action-row-inline">
                <Button
                  variant="secondary"
                  size="small"
                  onClick={handleOpenRoomSingle}
                >
                  新增房间
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={handleOpenRoomBatch}
                >
                  批量添加
                </Button>
              </View>
            ) : undefined
          }
        >
          <ScrollView className="apartment-inner-list" scrollY>
            {apartmentRooms.map((room) => (
              <View key={room.id} className="room-card">
                <View className="room-card-header">
                  <View>
                    <Text className="card-title">{room.roomNo}</Text>
                    <Text className="text-muted">
                      {room.layout} · {room.area ?? '未填'}㎡
                    </Text>
                  </View>
                  <Badge tone={toneForStatus[room.status]}>
                    {statusLabels[room.status]}
                  </Badge>
                </View>
                <Text className="text-muted">
                  {facilitiesText(room.facilities)}
                </Text>
                {canManageRoom ? (
                  <View className="action-row-inline">
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => handleOpenRoomEdit(room)}
                    >
                      编辑
                    </Button>
                    <Button
                      variant="danger"
                      size="small"
                      disabled={room.status === 'OCCUPIED'}
                      onClick={() => handleDeleteRoom(room)}
                    >
                      删除
                    </Button>
                  </View>
                ) : null}
              </View>
            ))}
            {apartmentRooms.length === 0 ? (
              <Text className="text-muted">
                暂无房间，可以新增单个房间或批量添加
              </Text>
            ) : null}
          </ScrollView>
        </Card>
      ) : null}
    </View>
  );
}
