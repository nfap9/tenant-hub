import { useMemo, useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { styles } from "../theme/styles";
import { TaskSheet } from "./TaskSheet";

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
      <TouchableOpacity style={styles.feeItem} onPress={() => setDrawerOpen(true)}>
        <View>
          <Text style={styles.cardTitle}>{selectedRoom?.apartmentName ?? "请选择房间"}</Text>
          {selectedRoom ? <Text style={styles.muted}>{selectedRoom.roomNo}</Text> : null}
        </View>
        <Text style={styles.link}>选择</Text>
      </TouchableOpacity>
      <TaskSheet
        visible={drawerOpen}
        variant="drawer"
        title={label}
        subtitle="搜索公寓或房号后选择房间"
        onClose={() => setDrawerOpen(false)}
      >
        <>
          <TextInput style={styles.input} placeholder="搜索公寓或房号" value={search} onChangeText={setSearch} />
          {filteredRooms.map((room) => (
            <TouchableOpacity
              key={room.id}
              style={[styles.feeItem, selectedRoomId === room.id && styles.feeItemActive]}
              onPress={() => {
                onSelectRoom(room.id);
                setDrawerOpen(false);
                setSearch("");
              }}
            >
              <Text style={styles.cardTitle}>{room.apartmentName}</Text>
              <Text style={styles.muted}>{room.roomNo}</Text>
            </TouchableOpacity>
          ))}
          {filteredRooms.length === 0 ? <Text style={styles.muted}>{emptyText}</Text> : null}
        </>
      </TaskSheet>
    </View>
  );
}
