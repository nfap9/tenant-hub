import { useState, useMemo, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import { Button, Input } from '../../../components/ui';
import { TaskSheet } from '../../../components/TaskSheet';
import { buildBatchRoomNos, groupBatchRoomNosByFloor, toggleBatchRoomSelection } from '../../../utils/batchRooms';

interface RoomBatchSheetProps {
  visible: boolean;
  onSave: (roomNos: string[]) => Promise<void> | void;
  onClose: () => void;
}

export function RoomBatchSheet({ visible, onSave, onClose }: RoomBatchSheetProps) {
  const [batchStartFloor, setBatchStartFloor] = useState("2");
  const [batchEndFloor, setBatchEndFloor] = useState("4");
  const [batchRoomCount, setBatchRoomCount] = useState("4");
  const [selectedBatchRoomNos, setSelectedBatchRoomNos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const generatedBatchRoomNos = useMemo(
    () => buildBatchRoomNos({ startFloor: batchStartFloor, endFloor: batchEndFloor, roomCount: batchRoomCount }),
    [batchStartFloor, batchEndFloor, batchRoomCount]
  );

  const selectedGeneratedBatchRoomNos = useMemo(
    () => generatedBatchRoomNos.filter((roomNo) => selectedBatchRoomNos.includes(roomNo)),
    [generatedBatchRoomNos, selectedBatchRoomNos]
  );

  const batchRoomGroups = useMemo(() => groupBatchRoomNosByFloor(generatedBatchRoomNos), [generatedBatchRoomNos]);

  useEffect(() => {
    setSelectedBatchRoomNos(generatedBatchRoomNos);
  }, [generatedBatchRoomNos]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(selectedGeneratedBatchRoomNos);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setBatchStartFloor("2");
    setBatchEndFloor("4");
    setBatchRoomCount("4");
    setSelectedBatchRoomNos([]);
    onClose();
  };

  return (
    <TaskSheet
      visible={visible}
      title="批量添加房间"
      onClose={handleClose}
      footer={(
        <>
          <Button loading={saving} disabled={saving} onClick={handleSave}>确认添加房间</Button>
          <Button variant="ghost" onClick={handleClose}>取消</Button>
        </>
      )}
    >
      <View className="form-grid">
        <Input label="开始楼层" placeholder="例如 2" type="number" value={batchStartFloor} onChange={setBatchStartFloor} />
        <Input label="结束楼层" placeholder="例如 4" type="number" value={batchEndFloor} onChange={setBatchEndFloor} />
        <Input label="每层房间数" placeholder="例如 4" type="number" value={batchRoomCount} onChange={setBatchRoomCount} />
      </View>
      <View className="batch-room-panel">
        <View className="detail-row">
          <Text className="field-label">生成房间号</Text>
          <Text className="text-muted">已选 {selectedGeneratedBatchRoomNos.length}/{generatedBatchRoomNos.length}</Text>
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
                      <Button key={roomNo} variant={selected ? "primary" : "ghost"} size="small" onClick={() => setSelectedBatchRoomNos((old) => toggleBatchRoomSelection(old, roomNo))}>
                        {roomNo}
                      </Button>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        ) : <Text className="text-muted">输入有效的楼层范围和每层房间数后会自动生成房间号</Text>}
      </View>
    </TaskSheet>
  );
}
