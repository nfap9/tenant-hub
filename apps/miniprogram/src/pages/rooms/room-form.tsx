import { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import {
  useAppSession,
  useHasPermission,
} from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { Button, Card, Input, FacilitySelector } from '../../components/ui';
import { statusLabels, roomStatuses } from './constants';
import type { Room, RoomStatus } from '../../types/domain';
import './index.scss';

export default function RoomFormPage() {
  const { currentOrgId } = useAppSession();
  const canManageRoom = useHasPermission('room:manage');
  const { params } = useRouter();
  const roomId = params.roomId;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [form, setForm] = useState({
    roomNo: '',
    layout: '',
    area: '',
    facilities: '',
    status: 'VACANT' as RoomStatus,
  });
  const [saving, setSaving] = useState(false);
  const initializedRef = useRef(false);

  const loadRooms = async () => {
    if (!currentOrgId) return;
    try {
      const data = await apiClient<Room[]>('/apartments/rooms', {
        organizationId: currentOrgId,
      });
      setRooms(data);
    } catch (e) {
      // silent
    }
  };

  useDidShow(() => {
    loadRooms();
  });

  const room = useMemo(
    () => rooms.find((r) => r.id === roomId),
    [rooms, roomId]
  );

  useEffect(() => {
    if (room && !initializedRef.current) {
      setForm({
        roomNo: room.roomNo,
        layout: room.layout,
        area: room.area ? String(room.area) : '',
        facilities: room.facilities.join(','),
        status: room.status,
      });
      initializedRef.current = true;
    }
  }, [room]);

  const updateForm = (key: keyof typeof form, value: string | RoomStatus) =>
    setForm((old) => ({ ...old, [key]: value }));

  const handleBack = () => {
    Taro.navigateBack();
  };

  const handleSave = async () => {
    if (!currentOrgId || !room) return;
    if (!canManageRoom) {
      Taro.showToast({ title: '当前角色没有管理房间权限', icon: 'none' });
      return;
    }
    if (!form.roomNo.trim() || !form.layout.trim()) {
      Taro.showToast({ title: '请填写房间号和户型', icon: 'none' });
      return;
    }

    setSaving(true);
    try {
      await apiClient(`/apartments/rooms/${room.id}`, {
        method: 'PUT',
        body: {
          roomNo: form.roomNo.trim(),
          layout: form.layout.trim(),
          area: form.area.trim() ? Number(form.area) : undefined,
          facilities: form.facilities
            .split(/[,，]/)
            .map((item) => item.trim())
            .filter(Boolean),
          status: form.status,
        },
        organizationId: currentOrgId,
      });
      Taro.showToast({ title: '房间信息已更新', icon: 'success' });
      Taro.navigateBack();
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '保存房间失败',
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
      <Card title="编辑房间">
        <Input
          label="房间号"
          placeholder="例如 301"
          value={form.roomNo}
          onChange={(value) => updateForm('roomNo', value)}
        />
        <View className="form-grid">
          <Input
            label="户型"
            placeholder="例如 开间"
            value={form.layout}
            onChange={(value) => updateForm('layout', value)}
          />
          <Input
            label="面积"
            placeholder="平方米"
            type="number"
            value={form.area}
            onChange={(value) => updateForm('area', value)}
          />
        </View>
        <FacilitySelector
          value={form.facilities}
          onChange={(value) => updateForm('facilities', value)}
        />
        <Text className="field-label">状态</Text>
        <View className="segment">
          {roomStatuses.map((item) => (
            <View
              key={item}
              className={`segment-item ${form.status === item ? 'segment-item--active' : ''}`}
              onClick={() => updateForm('status', item)}
            >
              <Text
                className={`segment-text ${form.status === item ? 'segment-text--active' : ''}`}
              >
                {statusLabels[item]}
              </Text>
            </View>
          ))}
        </View>
        <Button loading={saving} disabled={saving} onClick={handleSave}>
          保存房间信息
        </Button>
        <Button variant="ghost" onClick={handleBack}>
          取消
        </Button>
      </Card>
    </View>
  );
}
