import { View, Text } from '@tarojs/components';
import { Button, Input, FacilitySelector } from '../../../components/ui';
import { TaskSheet } from '../../../components/TaskSheet';
import { statusLabels, roomStatuses } from '../constants';
import type { Room, RoomStatus } from '../../../types/domain';

interface EditRoomSheetProps {
  visible: boolean;
  room?: Room;
  form: { roomNo: string; layout: string; area: string; facilities: string; status: RoomStatus };
  onUpdateForm: (key: string, value: string | RoomStatus) => void;
  onSave: () => void;
  onClose: () => void;
}

export function EditRoomSheet({ visible, room, form, onUpdateForm, onSave, onClose }: EditRoomSheetProps) {
  return (
    <TaskSheet
      visible={visible}
      title="编辑房间"
      onClose={onClose}
      footer={(
        <>
          <Button onClick={onSave}>保存房间信息</Button>
          <Button variant="ghost" onClick={onClose}>取消</Button>
        </>
      )}
    >
      <Input label="房间号" placeholder="例如 301" value={form.roomNo} onChange={(value) => onUpdateForm("roomNo", value)} />
      <View className="form-grid">
        <Input label="户型" placeholder="例如 开间" value={form.layout} onChange={(value) => onUpdateForm("layout", value)} />
        <Input label="面积" placeholder="平方米" type="number" value={form.area} onChange={(value) => onUpdateForm("area", value)} />
      </View>
      <FacilitySelector value={form.facilities} onChange={(value) => onUpdateForm("facilities", value)} />
      <View className="segment">
        {roomStatuses.map((item) => (
          <View key={item} className={`segment-item ${form.status === item ? 'segment-item--active' : ''}`} onClick={() => onUpdateForm("status", item)}>
            <Text className={`segment-text ${form.status === item ? 'segment-text--active' : ''}`}>{statusLabels[item]}</Text>
          </View>
        ))}
      </View>
    </TaskSheet>
  );
}
