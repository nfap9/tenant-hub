import type { Room } from "../../types";

export const getLeaseCandidateRooms = (rooms: Room[]) => rooms.filter((room) => room.status === "VACANT");
