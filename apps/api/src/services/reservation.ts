import { prisma } from '../config/prisma.js';

export const findRoomForReservation = async (
  roomId: string,
  organizationId: string
) => {
  return prisma.room.findFirst({
    where: {
      id: roomId,
      apartment: { organizationId },
    },
    select: {
      id: true,
      status: true,
      apartmentId: true,
      roomNo: true,
      apartment: { select: { name: true } },
    },
  });
};

export const findReservationByRoomId = async (roomId: string) => {
  return prisma.reservation.findUnique({
    where: { roomId },
  });
};

export const upsertReservation = async (data: {
  roomId: string;
  name: string;
  phone: string;
  deposit: number;
  paymentMethod?: string | null;
  expectedMoveInDate: Date;
  organizationId: string;
  userId: string;
  roomStatus: string;
  apartmentId: string;
  roomNo: string;
  apartmentName: string;
}) => {
  const {
    roomId,
    name,
    phone,
    deposit,
    paymentMethod,
    expectedMoveInDate,
    organizationId,
    userId,
    roomStatus,
    apartmentId,
    roomNo,
    apartmentName,
  } = data;

  const existing = await findReservationByRoomId(roomId);

  return prisma.$transaction(async (tx) => {
    const reservationData = {
      name,
      phone,
      deposit,
      paymentMethod: deposit > 0 ? paymentMethod || null : null,
      expectedMoveInDate,
    };

    let reservationRecord;
    if (existing) {
      reservationRecord = await tx.reservation.update({
        where: { roomId },
        data: reservationData,
      });
    } else {
      reservationRecord = await tx.reservation.create({
        data: { roomId, ...reservationData },
      });
    }

    if (roomStatus !== 'RESERVED') {
      await tx.room.update({
        where: { id: roomId },
        data: { status: 'RESERVED' },
      });
    }

    if (deposit > 0) {
      await tx.transaction.create({
        data: {
          organizationId,
          type: 'INCOME',
          category: 'RESERVATION_FEE',
          amount: deposit,
          method: paymentMethod || '现金',
          description: `${apartmentName} - ${roomNo} 预订定金`,
          operatorId: userId,
          sourceType: 'RESERVATION',
          sourceId: reservationRecord.id,
          apartmentId,
        },
      });
    }

    return tx.reservation.findUniqueOrThrow({
      where: { roomId },
      include: { room: true },
    });
  });
};

export const deleteReservation = async (roomId: string) => {
  await prisma.$transaction([
    prisma.reservation.delete({ where: { roomId } }),
    prisma.room.update({
      where: { id: roomId },
      data: { status: 'VACANT' },
    }),
  ]);
};

export const getReservationByRoomId = async (roomId: string) => {
  return prisma.reservation.findUnique({
    where: { roomId },
  });
};

export const queryReservationForAgent = async ({
  organizationId,
  roomId,
}: {
  organizationId: string;
  roomId: string;
}) => {
  const reservation = await prisma.reservation.findUnique({
    where: {
      roomId,
      room: {
        apartment: { organizationId },
      },
    },
    include: {
      room: {
        select: {
          roomNo: true,
          status: true,
          apartment: { select: { name: true } },
        },
      },
    },
  });

  if (!reservation) {
    return { exists: false };
  }

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
};
