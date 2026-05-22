import { useState, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useAppSession } from '../../context/AppSessionContext';
import { apiClient } from '../../api/client';
import { Button, Card, Input, DateField } from '../../components/ui';
import { today } from '../../utils/format';
import type { MeterType, Room } from '../../types/domain';
import './index.scss';

export default function ReadingPage() {
  const { currentOrgId } = useAppSession();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [form, setForm] = useState({
    roomId: '',
    meterType: 'WATER' as MeterType,
    readingDate: today(),
    value: '',
    note: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadRooms = async () => {
    if (!currentOrgId) return;
    try {
      const data = await apiClient<Room[]>('/apartments/rooms', {
        organizationId: currentOrgId,
      });
      setRooms(data);
      if (data.length > 0) {
        setForm((old) => ({ ...old, roomId: data[0].id }));
      }
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '加载失败',
        icon: 'none',
      });
    }
  };

  useEffect(() => {
    loadRooms();
  }, [currentOrgId]);

  const handleBack = () => {
    Taro.navigateBack();
  };

  const handleSubmit = async () => {
    if (!currentOrgId || !form.roomId || !form.value.trim()) return;
    setSubmitting(true);
    try {
      await apiClient('/bills/meter-readings', {
        method: 'POST',
        body: {
          roomId: form.roomId,
          meterType: form.meterType,
          readingDate: form.readingDate,
          value: Number(form.value),
          note: form.note.trim() || undefined,
        },
        organizationId: currentOrgId,
      });
      Taro.showToast({ title: '抄表记录已保存', icon: 'success' });
      Taro.navigateBack();
    } catch (e) {
      Taro.showToast({
        title: e instanceof Error ? e.message : '保存失败',
        icon: 'none',
      });
    } finally {
      setSubmitting(false);
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
      <Card title="录入抄表">
        <Text className="field-label">选择房间</Text>
        <View className="segment">
          {rooms.map((room) => (
            <View
              key={room.id}
              className={`segment-item ${form.roomId === room.id ? 'segment-item--active' : ''}`}
              onClick={() => setForm((old) => ({ ...old, roomId: room.id }))}
            >
              <Text
                className={`segment-text ${form.roomId === room.id ? 'segment-text--active' : ''}`}
              >
                {room.roomNo}
              </Text>
            </View>
          ))}
        </View>
        <Text className="field-label">表类型</Text>
        <View className="segment">
          {(['WATER', 'POWER'] as MeterType[]).map((type) => (
            <View
              key={type}
              className={`segment-item ${form.meterType === type ? 'segment-item--active' : ''}`}
              onClick={() => setForm((old) => ({ ...old, meterType: type }))}
            >
              <Text
                className={`segment-text ${form.meterType === type ? 'segment-text--active' : ''}`}
              >
                {type === 'WATER' ? '水表' : '电表'}
              </Text>
            </View>
          ))}
        </View>
        <View className="form-grid">
          <DateField
            label="抄表日期"
            placeholder="选择日期"
            value={form.readingDate}
            onChange={(value) =>
              setForm((old) => ({ ...old, readingDate: value }))
            }
          />
          <Input
            label="读数"
            placeholder="请输入读数"
            type="number"
            value={form.value}
            onChange={(value) => setForm((old) => ({ ...old, value }))}
          />
        </View>
        <Input
          label="备注"
          placeholder="可选"
          value={form.note}
          onChange={(value) => setForm((old) => ({ ...old, note: value }))}
        />
        <Button
          loading={submitting}
          disabled={submitting}
          onClick={handleSubmit}
        >
          保存读数
        </Button>
        <Button variant="ghost" onClick={handleBack}>
          取消
        </Button>
      </Card>
    </View>
  );
}
