import { useState, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import { Button, Input, FacilitySelector } from '../../../components/ui';
import { TaskSheet } from '../../../components/TaskSheet';
import { emptyRoomForm, roomLayoutOptions, roomStatuses, statusLabels } from '../constants';
import type { Room, RoomStatus } from '../../../types/domain';

interface RoomEditSheetProps {
  visible: boolean;
  room: Room | undefined;
  onSave: (room: { roomNo: string; layout: string; area: string; facilities: string; status: RoomStatus }) => Promise<void> | void;
  onClose: () => void;
}

export function RoomEditSheet({ visible, room, onSave, onClose }: RoomEditSheetProps) {
  const [roomForm, setRoomForm] = useState({ ...emptyRoomForm });
  const [saving, setSaving] = useState(false);

  const updateRoomForm = (key: keyof typeof roomForm, value: string | RoomStatus) => setRoomForm((old) => ({ ...old, [key]: value }));

  useEffect(() => {
    if (visible && room) {
      setRoomForm({
        roomNo: room.roomNo,
        layout: room.layout,
        area: room.area ? String(room.area) : "",
        facilities: room.facilities?.join(",") ?? "",
        status: room.status
      });
    }
  }, [visible, room]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(roomForm);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setRoomForm({ ...emptyRoomForm });
    onClose();
  };

  return (
    <TaskSheet
      visible={visible}
      title="编辑房间"
      onClose={handleClose}
      footer={(
        <>
          <Button loading={saving} disabled={saving} onClick={handleSave}>保存修改</Button>
          <Button variant="ghost" onClick={handleClose}>取消</Button>
        </>
      )}
    >
      <View className="form-grid">
        <Input label="房间号" placeholder="例如 301" value={roomForm.roomNo} onChange={(value) => updateRoomForm("roomNo", value)} />
        <Input label="面积" placeholder="平方米" type="number" value={roomForm.area} onChange={(value) => updateRoomForm("area", value)} />
      </View>
      <Text className="field-label">户型</Text>
      <View className="layout-selector">
        {roomLayoutOptions.map((layout) => (
          <Button key={layout} variant={roomForm.layout === layout ? "primary" : "ghost"} size="small" onClick={() => updateRoomForm("layout", layout)}>{layout}</Button>
        ))}
      </View>
      <FacilitySelector value={roomForm.facilities} onChange={(value) => updateRoomForm("facilities", value)} />
      <Text className="field-label">状态</Text>
      <View className="layout-selector">
        {roomStatuses.map((status) => (
          <Button key={status} variant={roomForm.status === status ? "primary" : "ghost"} size="small" onClick={() => updateRoomForm("status", status)}>{statusLabels[status]}</Button>
        ))}
      </View>
    </TaskSheet>
  );
}
