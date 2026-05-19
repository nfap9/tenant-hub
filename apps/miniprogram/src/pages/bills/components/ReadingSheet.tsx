import { useState, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import { Button, Input, DateField } from '../../../components/ui';
import { TaskSheet } from '../../../components/TaskSheet';
import { today } from '../../../utils/format';
import type { MeterType, Room } from '../../../types/domain';

interface ReadingSheetProps {
  visible: boolean;
  rooms: Room[];
  onSubmit: (roomId: string, meterType: MeterType, readingDate: string, value: string, note: string) => Promise<void> | void;
  onClose: () => void;
}

export function ReadingSheet({ visible, rooms, onSubmit, onClose }: ReadingSheetProps) {
  const [form, setForm] = useState({ roomId: "", meterType: "WATER" as MeterType, readingDate: today(), value: "", note: "" });

  useEffect(() => {
    if (visible && rooms.length > 0 && !form.roomId) {
      setForm((old) => ({ ...old, roomId: rooms[0].id }));
    }
  }, [visible, rooms, form.roomId]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.roomId || !form.value.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(form.roomId, form.meterType, form.readingDate, form.value, form.note);
      setForm((old) => ({ ...old, value: "", note: "" }));
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TaskSheet
      visible={visible}
      title="录入抄表"
      onClose={onClose}
      footer={(
        <>
          <Button loading={submitting} disabled={submitting} onClick={handleSubmit}>保存读数</Button>
          <Button variant="ghost" onClick={onClose}>取消</Button>
        </>
      )}
    >
      <Text className="field-label">选择房间</Text>
      <View className="segment">
        {rooms.map((room) => (
          <View key={room.id} className={`segment-item ${form.roomId === room.id ? 'segment-item--active' : ''}`} onClick={() => setForm((old) => ({ ...old, roomId: room.id }))}>
            <Text className={`segment-text ${form.roomId === room.id ? 'segment-text--active' : ''}`}>{room.roomNo}</Text>
          </View>
        ))}
      </View>
      <Text className="field-label">表类型</Text>
      <View className="segment">
        {(["WATER", "POWER"] as MeterType[]).map((type) => (
          <View key={type} className={`segment-item ${form.meterType === type ? 'segment-item--active' : ''}`} onClick={() => setForm((old) => ({ ...old, meterType: type }))}>
            <Text className={`segment-text ${form.meterType === type ? 'segment-text--active' : ''}`}>{type === "WATER" ? "水表" : "电表"}</Text>
          </View>
        ))}
      </View>
      <View className="form-grid">
        <DateField label="抄表日期" placeholder="选择日期" value={form.readingDate} onChange={(value) => setForm((old) => ({ ...old, readingDate: value }))} />
        <Input label="读数" placeholder="请输入读数" type="number" value={form.value} onChange={(value) => setForm((old) => ({ ...old, value }))} />
      </View>
      <Input label="备注" placeholder="可选" value={form.note} onChange={(value) => setForm((old) => ({ ...old, note: value }))} />
    </TaskSheet>
  );
}
