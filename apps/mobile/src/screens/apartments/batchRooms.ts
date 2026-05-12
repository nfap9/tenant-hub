type BatchRoomRange = {
  startFloor: string;
  endFloor: string;
  roomCount: string;
};

export const MAX_BATCH_ROOM_COUNT = 200;

const positiveInteger = (value: string) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

export const buildBatchRoomNos = ({ startFloor, endFloor, roomCount }: BatchRoomRange) => {
  const start = positiveInteger(startFloor);
  const end = positiveInteger(endFloor);
  const count = positiveInteger(roomCount);
  if (!start || !end || !count) return [];

  const firstFloor = Math.min(start, end);
  const lastFloor = Math.max(start, end);
  const totalRooms = (lastFloor - firstFloor + 1) * count;
  if (totalRooms > MAX_BATCH_ROOM_COUNT) return [];

  const roomNos: string[] = [];

  for (let floor = firstFloor; floor <= lastFloor; floor += 1) {
    for (let roomIndex = 1; roomIndex <= count; roomIndex += 1) {
      roomNos.push(`${floor}${String(roomIndex).padStart(2, '0')}`);
    }
  }

  return roomNos;
};

export const toggleBatchRoomSelection = (selectedRoomNos: string[], roomNo: string) =>
  selectedRoomNos.includes(roomNo)
    ? selectedRoomNos.filter(item => item !== roomNo)
    : [...selectedRoomNos, roomNo];
