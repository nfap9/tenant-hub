import { useState, useCallback } from 'react';
import { ScrollView, View, Text } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import {
  useAppSession,
  useHasPermission,
} from '../../context/AppSessionContext';
import { getRoom, updateRoom, deleteRoom } from '../../api/rooms';
import { activateLease } from '../../api/leases';
import { Button, Card, Badge } from '../../components/ui';
import { money, facilitiesText } from '../../utils/format';
import { statusLabels, toneForStatus, cycleLabels } from '../rooms/constants';
import type { Room } from '../../types/domain';
import './index.scss';

export default function RoomDetailPage() {
  const { currentOrgId } = useAppSession();
  const canManageRoom = useHasPermission('room:manage');
  const canManageLease = useHasPermission('lease:manage');
  const { params } = useRouter();
  const roomId = params.id;

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOrgId || !roomId) return;
    setLoading(true);
    try {
      const data = await getRoom(currentOrgId, roomId);
      setRoom(data);
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '加载房间详情失败',
        icon: 'none',
      });
    } finally {
      setLoading(false);
    }
  }, [currentOrgId, roomId]);

  useDidShow(() => {
    loadData();
  });

  const handleDelete = async () => {
    if (!currentOrgId || !room) return;
    if (room.status === 'OCCUPIED') {
      Taro.showToast({
        title: '已租房间不能删除，请先退租',
        icon: 'none',
      });
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
      Taro.navigateBack();
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '删除房间失败',
        icon: 'none',
      });
    }
  };

  const handleActivate = async (leaseId: string) => {
    if (!currentOrgId) return;
    try {
      await activateLease(currentOrgId, leaseId);
      Taro.showToast({ title: '租约已激活', icon: 'success' });
      loadData();
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '激活租约失败',
        icon: 'none',
      });
    }
  };

  const handleRoomStatus = async (
    status: 'VACANT' | 'RESERVED' | 'MAINTENANCE'
  ) => {
    if (!currentOrgId || !roomId) return;
    try {
      await updateRoom(currentOrgId, roomId, { status });
      Taro.showToast({ title: '房间状态已更新', icon: 'success' });
      loadData();
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '更新房间状态失败',
        icon: 'none',
      });
    }
  };

  const handleEdit = () => {
    if (room) {
      Taro.navigateTo({
        url: `/pages/rooms/room-form?id=${room.id}`,
      });
    }
  };

  const handleLeaseForm = () => {
    if (room) {
      Taro.navigateTo({
        url: `/pages/rooms/lease-form?roomId=${room.id}`,
      });
    }
  };

  const handleLeaseEdit = (leaseId: string) => {
    Taro.navigateTo({
      url: `/pages/rooms/lease-edit?leaseId=${leaseId}`,
    });
  };

  const handleLeaseTerminate = (leaseId: string) => {
    Taro.navigateTo({
      url: `/pages/rooms/lease-terminate?leaseId=${leaseId}`,
    });
  };

  if (!room && !loading) {
    return (
      <View className="page-container">
        <Text className="text-muted">房间不存在或已删除</Text>
      </View>
    );
  }

  const activeLease = room?.leases?.find((l) => l.status === 'ACTIVE');
  const draftLease = room?.leases?.find((l) => l.status === 'DRAFT');

  return (
    <ScrollView className="page-container" scrollY>
      <View className="sub-page-header">
        <Button
          className="page-back-button"
          variant="ghost"
          size="small"
          onClick={() => Taro.navigateBack()}
        >
          ‹ 返回
        </Button>
      </View>

      {room && (
        <>
          <Card
            title={room.roomNo}
            subtitle={`${room.apartment?.name} · ${room.layout}`}
            headerAction={
              canManageRoom ? (
                <View className="action-row-inline">
                  <Button variant="secondary" size="small" onClick={handleEdit}>
                    编辑
                  </Button>
                  <Button
                    variant="danger"
                    size="small"
                    disabled={room.status === 'OCCUPIED'}
                    onClick={handleDelete}
                  >
                    删除
                  </Button>
                </View>
              ) : undefined
            }
          >
            <View className="detail-panel">
              <View className="detail-row">
                <Text className="text-muted">状态</Text>
                <Badge tone={toneForStatus[room.status]}>
                  {statusLabels[room.status]}
                </Badge>
              </View>
              <View className="detail-row">
                <Text className="text-muted">面积</Text>
                <Text>{room.area ? `${room.area} ㎡` : '未填'}</Text>
              </View>
              <View className="detail-row">
                <Text className="text-muted">设施</Text>
                <Text>{facilitiesText(room.facilities)}</Text>
              </View>
            </View>

            {canManageRoom && room.status === 'VACANT' && (
              <View className="action-row-inline">
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => handleRoomStatus('RESERVED')}
                >
                  预留
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => handleRoomStatus('MAINTENANCE')}
                >
                  报修
                </Button>
              </View>
            )}
            {canManageRoom && room.status === 'RESERVED' && (
              <Button
                variant="secondary"
                size="small"
                onClick={() => handleRoomStatus('VACANT')}
              >
                取消预留
              </Button>
            )}
            {canManageRoom && room.status === 'MAINTENANCE' && (
              <Button
                variant="secondary"
                size="small"
                onClick={() => handleRoomStatus('VACANT')}
              >
                维修完成
              </Button>
            )}
          </Card>

          {activeLease && (
            <Card
              title="租约信息"
              headerAction={
                canManageLease ? (
                  <View className="action-row-inline">
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => handleLeaseEdit(activeLease.id)}
                    >
                      编辑
                    </Button>
                    <Button
                      variant="danger"
                      size="small"
                      onClick={() => handleLeaseTerminate(activeLease.id)}
                    >
                      退租
                    </Button>
                  </View>
                ) : undefined
              }
            >
              <View className="detail-panel">
                <View className="detail-row">
                  <Text className="text-muted">租客</Text>
                  <Text>
                    {activeLease.tenantName} · {activeLease.tenantPhone}
                  </Text>
                </View>
                <View className="detail-row">
                  <Text className="text-muted">租金</Text>
                  <Text className="card-stat">
                    ¥{money(activeLease.rentAmount)}/
                    {cycleLabels[activeLease.cycle]}
                  </Text>
                </View>
                <View className="detail-row">
                  <Text className="text-muted">押金</Text>
                  <Text>¥{money(activeLease.depositAmount)}</Text>
                </View>
                <View className="detail-row">
                  <Text className="text-muted">租期</Text>
                  <Text>
                    {activeLease.startDate.slice(0, 10)} 至{' '}
                    {activeLease.endDate.slice(0, 10)}
                  </Text>
                </View>
                <View className="detail-row">
                  <Text className="text-muted">水电单价</Text>
                  <Text>
                    水 ¥{money(activeLease.waterUnitPrice)} · 电 ¥
                    {money(activeLease.powerUnitPrice)}
                  </Text>
                </View>
                <View className="detail-row">
                  <Text className="text-muted">自动续约</Text>
                  <Text>{activeLease.autoRenew ? '是' : '否'}</Text>
                </View>
              </View>
              {activeLease.fees && activeLease.fees.length > 0 && (
                <View className="detail-panel">
                  <Text className="field-label">附加费用</Text>
                  {activeLease.fees.map((fee) => (
                    <View key={fee.id} className="detail-row">
                      <Text className="text-muted">{fee.name}</Text>
                      <Text>¥{money(fee.amount)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          )}

          {draftLease && (
            <Card
              title="草稿租约"
              headerAction={
                canManageLease ? (
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => handleActivate(draftLease.id)}
                  >
                    激活
                  </Button>
                ) : undefined
              }
            >
              <View className="detail-panel">
                <View className="detail-row">
                  <Text className="text-muted">租客</Text>
                  <Text>
                    {draftLease.tenantName} · {draftLease.tenantPhone}
                  </Text>
                </View>
                <View className="detail-row">
                  <Text className="text-muted">租金</Text>
                  <Text>
                    ¥{money(draftLease.rentAmount)}/
                    {cycleLabels[draftLease.cycle]}
                  </Text>
                </View>
                <View className="detail-row">
                  <Text className="text-muted">租期</Text>
                  <Text>
                    {draftLease.startDate.slice(0, 10)} 至{' '}
                    {draftLease.endDate.slice(0, 10)}
                  </Text>
                </View>
              </View>
            </Card>
          )}

          {!activeLease &&
            !draftLease &&
            canManageLease &&
            room.status === 'VACANT' && (
              <Card title="租约信息">
                <View className="detail-panel">
                  <Text className="text-muted">当前房间空闲，暂无租约</Text>
                  <Button onClick={handleLeaseForm}>签约入住</Button>
                </View>
              </Card>
            )}
        </>
      )}
    </ScrollView>
  );
}
