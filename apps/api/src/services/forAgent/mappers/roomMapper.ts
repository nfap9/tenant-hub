import type { Prisma } from '@prisma/client';

type RoomWithApartment = Prisma.RoomGetPayload<{
  include: { apartment: { select: { name: true } } };
}>;

export function toAgentRoomSummary(room: RoomWithApartment) {
  return {
    id: room.id,
    roomNo: room.roomNo,
    apartmentName: room.apartment.name,
    layout: room.layout,
    status: room.status,
    area: room.area ? Number(room.area) : null,
    facilities: room.facilities,
  };
}

type RoomDetail = Prisma.RoomGetPayload<{
  include: {
    apartment: { select: { id: true; name: true; location: true } };
    reservation: true;
    leases: {
      where: { status: 'ACTIVE'; deletedAt: null };
      include: { fees: true; deposits: true };
    };
    meterReadings: {
      take: 2;
      select: { meterType: true; readingDate: true; value: true };
    };
  };
}>;

export function toAgentRoomDetail(
  room: RoomDetail,
  currentMonthBills: Array<{
    id: string;
    status: string;
    totalAmount: Prisma.Decimal;
    mode: string;
  }>
) {
  const activeLease = room.leases[0];
  const leaseInfo = activeLease
    ? {
        leaseId: activeLease.id,
        tenantName: activeLease.tenantName,
        tenantPhone: activeLease.tenantPhone,
        startDate: activeLease.startDate.toISOString().split('T')[0],
        endDate: activeLease.endDate.toISOString().split('T')[0],
        rentAmount: Number(activeLease.rentAmount),
        cycle: activeLease.cycle,
        fees: activeLease.fees.map((f) => ({
          type: f.type,
          name: f.name,
          amount: Number(f.amount),
        })),
        deposits: activeLease.deposits.map((deposit) => ({
          type: deposit.type,
          amount: Number(deposit.amount),
          paidAmount: Number(deposit.paidAmount),
          status: deposit.status,
        })),
      }
    : null;

  return {
    id: room.id,
    roomNo: room.roomNo,
    apartmentName: room.apartment.name,
    apartmentLocation: room.apartment.location,
    layout: room.layout,
    status: room.status,
    area: room.area ? Number(room.area) : null,
    facilities: room.facilities,
    reservation: room.reservation
      ? {
          name: room.reservation.name,
          phone: room.reservation.phone,
          deposit: Number(room.reservation.deposit),
          expectedMoveInDate: room.reservation.expectedMoveInDate
            .toISOString()
            .split('T')[0],
        }
      : null,
    activeLease: leaseInfo,
    currentMonthBills: currentMonthBills.map((b) => ({
      id: b.id,
      status: b.status,
      totalAmount: Number(b.totalAmount),
      mode: b.mode,
    })),
    recentReadings: room.meterReadings.map((r) => ({
      meterType: r.meterType,
      readingDate: r.readingDate.toISOString().split('T')[0],
      value: Number(r.value),
    })),
  };
}
