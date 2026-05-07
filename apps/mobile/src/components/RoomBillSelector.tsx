import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Card, Input, PressableScale } from "./ui";
import { TaskSheet } from "./TaskSheet";
import { styles } from "../theme/styles";

export type SelectorRoom = {
  id: string;
  apartmentName: string;
  roomNo: string;
};

type Props = {
  rooms: SelectorRoom[];
  selectedRoomId: string;
  onSelectRoom: (roomId: string) => void;
  label?: string;
  emptyText?: string;
};

export function RoomBillSelector({ rooms, selectedRoomId, onSelectRoom, label = "选择房间", emptyText = "没有匹配的房间" }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId);
  const filteredRooms = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase();
    if (!keyword) return rooms;
    return rooms.filter((room) => `${room.apartmentName} ${room.roomNo}`.toLocaleLowerCase().includes(keyword));
  }, [rooms, search]);

  return (
    <View style={styles.billDetailBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <PressableScale scale={0.98} onPress={() => setDrawerOpen(true)}>
        <Card variant="outline" padding="md" gap={8}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={styles.cardTitle}>{selectedRoom?.apartmentName ?? "请选择房间"}</Text>
              {selectedRoom ? <Text style={styles.muted}>{selectedRoom.roomNo}</Text> : null}
            </View>
            <Text style={styles.link}>选择</Text>
          </View>
        </Card>
      </PressableScale>
      <TaskSheet
        visible={drawerOpen}
        variant="drawer"
        title={label}
        subtitle="搜索公寓或房号后选择房间"
        onClose={() => setDrawerOpen(false)}
      >
        <>
          <Input placeholder="搜索公寓或房号" value={search} onChangeText={setSearch} />
          {filteredRooms.map((room) => (
            <PressableScale
              key={room.id}
              scale={0.98}
              onPress={() => {
                onSelectRoom(room.id);
                setDrawerOpen(false);
                setSearch("");
              }}
            >
              <Card variant={selectedRoomId === room.id ? "default" : "outline"} padding="sm" gap={8}>
                <Text style={styles.cardTitle}>{room.apartmentName}</Text>
                <Text style={styles.muted}>{room.roomNo}</Text>
              </Card>
            </PressableScale>
          ))}
          {filteredRooms.length === 0 ? <Text style={styles.muted}>{emptyText}</Text> : null}
        </>
      </TaskSheet>
    </View>
  );
}
