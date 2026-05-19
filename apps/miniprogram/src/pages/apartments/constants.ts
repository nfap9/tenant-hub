import type { RoomStatus } from '../../types/domain';

export const emptyApartmentForm = {
  name: "",
  location: "",
  floors: "",
  landArea: "",
  totalArea: "",
  landlordName: "",
  landlordPhone: "",
  contractStart: "",
  contractEnd: "",
  rentAmount: ""
};

export const emptyRoomForm = {
  roomNo: "",
  layout: "开间",
  area: "",
  facilities: "",
  status: "VACANT" as RoomStatus
};

export const statusLabels: Record<RoomStatus, string> = {
  VACANT: "空闲",
  RESERVED: "预留",
  OCCUPIED: "已租",
  MAINTENANCE: "维修"
};

export const toneForStatus: Record<RoomStatus, "success" | "neutral" | "warning" | "danger"> = {
  VACANT: "success",
  RESERVED: "neutral",
  OCCUPIED: "warning",
  MAINTENANCE: "danger"
};

export const roomStatuses: RoomStatus[] = ["VACANT", "RESERVED", "OCCUPIED", "MAINTENANCE"];
export const roomLayoutOptions = ["开间", "一室一厅", "两室一厅", "两室两厅", "三室一厅", "三室两厅", "四室两厅"];
