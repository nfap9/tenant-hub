import { useState } from 'react';
import { View, Text } from '@tarojs/components';
import { Button, Input, FacilitySelector } from '../../../components/ui';
import { TaskSheet } from '../../../components/TaskSheet';
import { emptyRoomForm, roomLayoutOptions } from '../constants';

interface RoomSingleSheetProps {
  visible: boolean;
  onSave: (room: { roomNo: string; layout: string; area: string; facilities: string }) => Promise<void> | void;
  onClose: () => void;
}

export function RoomSingleSheet({ visible, onSave, onClose }: RoomSingleSheetProps) {
  const [roomForm, setRoomForm] = useState({ ...emptyRoomForm });
  const [saving, setSaving] = useState(false);

  const updateRoomForm = (key: keyof typeof roomForm, value: string) => setRoomForm((old) => ({ ...old, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(roomForm);
      setRoomForm({ ...emptyRoomForm });
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
      title="新增房间"
      onClose={handleClose}
      footer={(
        <>
          <Button loading={saving} disabled={saving} onClick={handleSave}>保存房间</Button>
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
    </TaskSheet>
  );
}
