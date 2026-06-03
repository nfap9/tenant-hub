import { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import {
  useAppSession,
  useHasPermission,
} from '../../context/AppSessionContext';
import { getApartments } from '../../api/apartments';
import { updateRoom, batchCreateRooms } from '../../api/rooms';
import { Button, Card, Input, FacilitySelector } from '../../components/ui';
import { optionalNumber, toFacilityArray } from '../../utils/format';
import {
  emptyRoomForm,
  roomLayoutOptions,
  roomStatuses,
  statusLabels,
} from './constants';
import type { Apartment, RoomStatus } from '../../types/domain';
import './index.scss';

export default function RoomFormPage() {
  const { currentOrgId } = useAppSession();
  const canManageRoom = useHasPermission('room:manage');
  const { params } = useRouter();
  const apartmentId = params.apartmentId;
  const roomId = params.roomId;
  const isEdit = !!roomId;

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [roomForm, setRoomForm] = useState({ ...emptyRoomForm });
  const [saving, setSaving] = useState(false);
  const initializedRef = useRef(false);

  const loadApartments = async () => {
    if (!currentOrgId) return;
    try {
      const data = await getApartments(currentOrgId);
      setApartments(data);
    } catch (e) {
      // silent
    }
  };

  useDidShow(() => {
    loadApartments();
  });

  const apartment = apartments.find((a) => a.id === apartmentId);
  const editingRoom = useMemo(() => {
    if (!roomId || !apartment) return undefined;
    return apartment.rooms?.find((r) => r.id === roomId);
  }, [apartment, roomId]);

  useEffect(() => {
    if (isEdit && editingRoom && !initializedRef.current) {
      setRoomForm({
        roomNo: editingRoom.roomNo,
        layout: editingRoom.layout,
        area: editingRoom.area ? String(editingRoom.area) : '',
        facilities: editingRoom.facilities?.join(',') ?? '',
        status: editingRoom.status,
      });
      initializedRef.current = true;
    }
    if (!isEdit) {
      setRoomForm({ ...emptyRoomForm });
      initializedRef.current = false;
    }
  }, [isEdit, editingRoom]);

  const updateRoomForm = (
    key: keyof typeof roomForm,
    value: string | RoomStatus
  ) => setRoomForm((old) => ({ ...old, [key]: value }));

  const handleBack = () => {
    Taro.navigateBack();
  };

  const handleSave = async () => {
    if (!currentOrgId) return;
    if (!canManageRoom) {
      Taro.showToast({ title: '当前角色没有管理房间权限', icon: 'none' });
      return;
    }
    if (!roomForm.roomNo.trim() || !roomForm.layout.trim()) {
      Taro.showToast({ title: '请填写房间号和户型', icon: 'none' });
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await updateRoom(currentOrgId, roomId, {
          roomNo: roomForm.roomNo.trim(),
          layout: roomForm.layout.trim(),
          area: optionalNumber(roomForm.area),
          facilities: toFacilityArray(roomForm.facilities),
          status: roomForm.status,
        });
        Taro.showToast({ title: '房间信息已更新', icon: 'success' });
      } else {
        if (!apartmentId) return;
        await batchCreateRooms(currentOrgId, apartmentId, {
          rooms: [
            {
              roomNo: roomForm.roomNo.trim(),
              layout: roomForm.layout.trim(),
              area: optionalNumber(roomForm.area),
              facilities: toFacilityArray(roomForm.facilities),
            },
          ],
        });
        Taro.showToast({ title: '房间已添加', icon: 'success' });
      }
      Taro.navigateBack();
    } catch (e) {
      Taro.showToast({
        title:
          e instanceof Error
            ? e.message
            : isEdit
              ? '更新房间失败'
              : '添加房间失败',
        icon: 'none',
      });
    } finally {
      setSaving(false);
    }
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
      <Card title={isEdit ? '编辑房间' : '新增房间'}>
        <View className="form-grid">
          <Input
            label="房间号"
            placeholder="例如 301"
            value={roomForm.roomNo}
            onChange={(value) => updateRoomForm('roomNo', value)}
          />
          <Input
            label="面积"
            placeholder="平方米"
            type="number"
            value={roomForm.area}
            onChange={(value) => updateRoomForm('area', value)}
          />
        </View>
        <Text className="field-label">户型</Text>
        <View className="layout-selector">
          {roomLayoutOptions.map((layout) => (
            <Button
              key={layout}
              variant={roomForm.layout === layout ? 'primary' : 'ghost'}
              size="small"
              onClick={() => updateRoomForm('layout', layout)}
            >
              {layout}
            </Button>
          ))}
        </View>
        <FacilitySelector
          value={roomForm.facilities}
          onChange={(value) => updateRoomForm('facilities', value)}
        />
        {isEdit ? (
          <>
            <Text className="field-label">状态</Text>
            <View className="layout-selector">
              {roomStatuses.map((status) => (
                <Button
                  key={status}
                  variant={roomForm.status === status ? 'primary' : 'ghost'}
                  size="small"
                  onClick={() => updateRoomForm('status', status)}
                >
                  {statusLabels[status]}
                </Button>
              ))}
            </View>
          </>
        ) : null}
        <Button loading={saving} disabled={saving} onClick={handleSave}>
          {isEdit ? '保存修改' : '保存房间'}
        </Button>
        <Button variant="ghost" onClick={handleBack}>
          取消
        </Button>
      </Card>
    </View>
  );
}
