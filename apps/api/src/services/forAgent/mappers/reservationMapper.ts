import type { Prisma } from '@prisma/client';

type ReservationWithRoom = Prisma.ReservationGetPayload<{
  include: {
    room: {
      select: {
        roomNo: true;
        status: true;
        apartment: { select: { name: true } };
      };
    };
  };
}>;

export function toAgentReservation(reservation: ReservationWithRoom) {
  return {
    exists: true,
    id: reservation.id,
    roomNo: reservation.room.roomNo,
    apartmentName: reservation.room.apartment.name,
    roomStatus: reservation.room.status,
    customerName: reservation.name,
    customerPhone: reservation.phone,
    deposit: Number(reservation.deposit),
    paymentMethod: reservation.paymentMethod,
    expectedMoveInDate: reservation.expectedMoveInDate
      .toISOString()
      .split('T')[0],
    createdAt: reservation.createdAt.toISOString().split('T')[0],
  };
}
