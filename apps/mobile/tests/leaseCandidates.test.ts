import assert from "node:assert/strict";
import { getLeaseCandidateRooms } from "../src/screens/rooms/leaseCandidates";
import type { Room } from "../src/types";

const rooms = [
  { id: "occupied", apartmentId: "apartment-1", roomNo: "101", layout: "一室", facilities: [], status: "OCCUPIED" },
  { id: "vacant-a", apartmentId: "apartment-1", roomNo: "102", layout: "一室", facilities: [], status: "VACANT" },
  { id: "maintenance", apartmentId: "apartment-1", roomNo: "103", layout: "一室", facilities: [], status: "MAINTENANCE" },
  { id: "vacant-b", apartmentId: "apartment-1", roomNo: "201", layout: "两室", facilities: [], status: "VACANT" }
] satisfies Room[];

assert.deepEqual(getLeaseCandidateRooms(rooms).map((room) => room.id), ["vacant-a", "vacant-b"]);
