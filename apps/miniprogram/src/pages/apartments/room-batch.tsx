import { useState, useMemo, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import {
  useAppSession,
  useHasPermission,
} from '../../context/AppSessionContext';
import { batchCreateRooms } from '../../api/rooms';
import { Button, Card, Input } from '../../components/ui';
import {
  buildBatchRoomNos,
  groupBatchRoomNosByFloor,
  toggleBatchRoomSelection,
} from '../../utils/batchRooms';
import './index.scss';

export default function RoomBatchPage() {
  const { currentOrgId } = useAppSession();
  const canManageRoom = useHasPermission('room:manage');
  const { params } = useRouter();
  const apartmentId = params.apartmentId;

  const [batchStartFloor, setBatchStartFloor] = useState('2');
  const [batchEndFloor, setBatchEndFloor] = useState('4');
  const [batchRoomCount, setBatchRoomCount] = useState('4');
  const [selectedBatchRoomNos, setSelectedBatchRoomNos] = useState<string[]>(
    []
  );
  const [saving, setSaving] = useState(false);

  const generatedBatchRoomNos = useMemo(
    () =>
      buildBatchRoomNos({
        startFloor: batchStartFloor,
        endFloor: batchEndFloor,
        roomCount: batchRoomCount,
      }),
    [batchStartFloor, batchEndFloor, batchRoomCount]
  );

  const selectedGeneratedBatchRoomNos = useMemo(
    () =>
      generatedBatchRoomNos.filter((roomNo) =>
        selectedBatchRoomNos.includes(roomNo)
      ),
    [generatedBatchRoomNos, selectedBatchRoomNos]
  );

  const batchRoomGroups = useMemo(
    () => groupBatchRoomNosByFloor(generatedBatchRoomNos),
    [generatedBatchRoomNos]
  );

  useEffect(() => {
    setSelectedBatchRoomNos(generatedBatchRoomNos);
  }, [generatedBatchRoomNos]);

  const handleSave = async () => {
    if (!currentOrgId || !apartmentId) return;
    if (!canManageRoom) {
      Taro.showToast({ title: '当前角色没有管理房间权限', icon: 'none' });
      return;
    }
    if (selectedGeneratedBatchRoomNos.length === 0) {
      Taro.showToast({ title: '请至少选择一个房间号', icon: 'none' });
      return;
    }

    setSaving(true);
    try {
      await batchCreateRooms(currentOrgId, apartmentId, {
        rooms: selectedGeneratedBatchRoomNos.map((roomNo) => ({
          roomNo,
          layout: '未配置',
          facilities: [],
        })),
      });
      Taro.showToast({
        title: `已提交 ${selectedGeneratedBatchRoomNos.length} 间房间，重复房间会自动跳过`,
        icon: 'success',
      });
      Taro.navigateBack();
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '批量添加房间失败',
        icon: 'none',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    Taro.navigateBack();
  };

  return (
    <View className="page-container">
      <View className="sub-page-header">
        <Button
          className="page-back-button"
          variant="ghost"
          size="small"
          onClick={handleBack}
        >
          ‹ 返回
        </Button>
      </View>
      <Card title="批量添加房间">
        <View className="form-grid">
          <Input
            label="开始楼层"
            placeholder="例如 2"
            type="number"
            value={batchStartFloor}
            onChange={setBatchStartFloor}
          />
          <Input
            label="结束楼层"
            placeholder="例如 4"
            type="number"
            value={batchEndFloor}
            onChange={setBatchEndFloor}
          />
          <Input
            label="每层房间数"
            placeholder="例如 4"
            type="number"
            value={batchRoomCount}
            onChange={setBatchRoomCount}
          />
        </View>
        <View className="batch-room-panel">
          <View className="detail-row">
            <Text className="field-label">生成房间号</Text>
            <Text className="text-muted">
              已选 {selectedGeneratedBatchRoomNos.length}/
              {generatedBatchRoomNos.length}
            </Text>
          </View>
          {generatedBatchRoomNos.length > 0 ? (
            <View className="batch-room-groups">
              {batchRoomGroups.map((group) => (
                <View key={group.floor} className="batch-room-row">
                  <Text className="batch-room-floor">{group.floor}层</Text>
                  <View className="batch-room-grid">
                    {group.roomNos.map((roomNo) => {
                      const selected = selectedBatchRoomNos.includes(roomNo);
                      return (
                        <Button
                          key={roomNo}
                          variant={selected ? 'primary' : 'ghost'}
                          size="small"
                          onClick={() =>
                            setSelectedBatchRoomNos((old) =>
                              toggleBatchRoomSelection(old, roomNo)
                            )
                          }
                        >
                          {roomNo}
                        </Button>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text className="text-muted">
              输入有效的楼层范围和每层房间数后会自动生成房间号
            </Text>
          )}
        </View>
        <Button loading={saving} disabled={saving} onClick={handleSave}>
          确认添加房间
        </Button>
        <Button variant="ghost" onClick={handleBack}>
          取消
        </Button>
      </Card>
    </View>
  );
}
