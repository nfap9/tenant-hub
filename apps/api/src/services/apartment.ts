import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { HttpError } from '../utils/http.js';
import { enforceOrganizationQuota } from './quotas.js';

export const ensureApartmentInOrg = async (
  apartmentId: string,
  organizationId: string
) => {
  const apartment = await prisma.apartment.findFirst({
    where: { id: apartmentId, organizationId },
    select: { id: true },
  });
  if (!apartment) throw new HttpError(404, '公寓不存在');
};

export const ensureRoomInOrg = async (
  roomId: string,
  organizationId: string
) => {
  const room = await prisma.room.findFirst({
    where: { id: roomId, apartment: { organizationId } },
    select: { id: true },
  });
  if (!room) throw new HttpError(404, '房间不存在');
};

export const listApartments = async (organizationId: string) => {
  return prisma.apartment.findMany({
    where: { organizationId },
    include: {
      contract: true,
      rooms: {
        include: {
          reservation: true,
          leases: {
            where: { status: 'ACTIVE' },
            include: {
              fees: true,
              bills: {
                select: { id: true, status: true, billingDate: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
      expenses: { orderBy: { spentAt: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const listRooms = async (organizationId: string) => {
  return prisma.room.findMany({
    where: { apartment: { organizationId } },
    include: {
      apartment: true,
      reservation: true,
      leases: {
        where: { status: 'ACTIVE' },
        include: {
          fees: true,
          deposit: true,
          bills: {
            select: { id: true, status: true, billingDate: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: [{ apartment: { createdAt: 'desc' } }, { roomNo: 'asc' }],
  });
};

export const getRoomById = async (roomId: string, organizationId: string) => {
  return prisma.room.findFirst({
    where: {
      id: roomId,
      apartment: { organizationId },
    },
    include: {
      apartment: true,
      reservation: true,
      leases: {
        where: { status: 'ACTIVE' },
        include: {
          fees: true,
          deposit: true,
          bills: {
            select: { id: true, status: true, billingDate: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
};

export const createApartment = async (data: {
  name: string;
  location: string;
  organizationId: string;
}) => {
  return prisma.$transaction(async (tx) => {
    await enforceOrganizationQuota(
      tx,
      data.organizationId,
      'apartment',
      async () => {
        const apartmentCount = await tx.apartment.count({
          where: { organizationId: data.organizationId },
        });
        return apartmentCount + 1;
      }
    );
    return tx.apartment.create({
      data: {
        name: data.name,
        location: data.location,
        organizationId: data.organizationId,
      },
    });
  });
};

export const updateApartment = async (
  apartmentId: string,
  data: Partial<Pick<Prisma.ApartmentCreateInput, 'name' | 'location'>>
) => {
  return prisma.apartment.update({
    where: { id: apartmentId },
    data,
  });
};

export const deleteApartment = async (apartmentId: string) => {
  return prisma.apartment.delete({ where: { id: apartmentId } });
};

export const countActiveLeasesInApartment = async (
  apartmentId: string,
  organizationId: string
) => {
  return prisma.lease.count({
    where: {
      organizationId,
      status: 'ACTIVE',
      room: { apartmentId },
    },
  });
};

export const createApartmentExpense = async (data: {
  apartmentId: string;
  name: string;
  amount: number;
  spentAt: Date;
  note?: string;
}) => {
  return prisma.apartmentExpense.create({
    data: {
      name: data.name,
      amount: data.amount,
      spentAt: data.spentAt,
      note: data.note,
      apartmentId: data.apartmentId,
    },
  });
};

export const getApartmentName = async (apartmentId: string) => {
  const apartment = await prisma.apartment.findUnique({
    where: { id: apartmentId },
    select: { name: true },
  });
  return apartment?.name;
};

export const batchCreateRooms = async (
  apartmentId: string,
  organizationId: string,
  rooms: Array<{
    roomNo: string;
    layout: string;
    area?: number;
    facilities: string[];
  }>
) => {
  return prisma.$transaction(async (tx) => {
    await enforceOrganizationQuota(tx, organizationId, 'room', async () => {
      const existingRooms = await tx.room.findMany({
        where: { apartment: { organizationId } },
        select: { apartmentId: true, roomNo: true },
      });
      const existingKeys = new Set(
        existingRooms.map((room) => `${room.apartmentId}:${room.roomNo}`)
      );
      const newRoomCount = rooms.filter(
        (room) => !existingKeys.has(`${apartmentId}:${room.roomNo}`)
      ).length;
      return existingRooms.length + newRoomCount;
    });
    return tx.room.createMany({
      data: rooms.map((room) => ({
        ...room,
        apartmentId,
      })),
      skipDuplicates: true,
    });
  });
};

export const updateRoom = async (
  roomId: string,
  data: Partial<{
    roomNo: string;
    layout: string;
    area: number;
    facilities: string[];
    status: 'VACANT' | 'RESERVED' | 'OCCUPIED' | 'MAINTENANCE';
  }>
) => {
  return prisma.room.update({
    where: { id: roomId },
    data,
  });
};

export const getRoomStatus = async (roomId: string) => {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { status: true },
  });
  return room?.status;
};

export const countActiveLeasesInRoom = async (
  roomId: string,
  organizationId: string
) => {
  return prisma.lease.count({
    where: {
      roomId,
      organizationId,
      status: 'ACTIVE',
    },
  });
};

export const deleteRoom = async (roomId: string) => {
  return prisma.room.delete({ where: { id: roomId } });
};

export const queryApartmentsForAgent = async ({
  organizationId,
  keyword,
  limit = 20,
}: {
  organizationId: string;
  keyword?: string;
  limit?: number;
}) => {
  const apartments = await prisma.apartment.findMany({
    where: {
      organizationId,
      deletedAt: null,
      ...(keyword
        ? {
            OR: [
              { name: { contains: keyword, mode: 'insensitive' } },
              { location: { contains: keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { rooms: { where: { deletedAt: null } } } },
      rooms: {
        where: { deletedAt: null },
        select: { status: true },
      },
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  return apartments.map((apt) => ({
    id: apt.id,
    name: apt.name,
    location: apt.location,
    roomCount: apt._count.rooms,
    occupiedCount: apt.rooms.filter((r) => r.status === 'OCCUPIED').length,
    vacantCount: apt.rooms.filter((r) => r.status === 'VACANT').length,
  }));
};

export const queryRoomsForAgent = async ({
  organizationId,
  apartmentId,
  status,
  keyword,
  limit = 30,
}: {
  organizationId: string;
  apartmentId?: string;
  status?: 'VACANT' | 'RESERVED' | 'OCCUPIED' | 'MAINTENANCE';
  keyword?: string;
  limit?: number;
}) => {
  const rooms = await prisma.room.findMany({
    where: {
      apartment: { organizationId },
      deletedAt: null,
      ...(apartmentId ? { apartmentId } : {}),
      ...(status ? { status } : {}),
      ...(keyword
        ? {
            OR: [
              { roomNo: { contains: keyword, mode: 'insensitive' } },
              { layout: { contains: keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: { apartment: { select: { name: true } } },
    take: limit,
    orderBy: [{ apartment: { createdAt: 'desc' } }, { roomNo: 'asc' }],
  });

  return rooms.map((room) => ({
    id: room.id,
    roomNo: room.roomNo,
    apartmentName: room.apartment.name,
    layout: room.layout,
    status: room.status,
    area: room.area ? Number(room.area) : null,
    facilities: room.facilities,
  }));
};

export const queryRoomDetailForAgent = async ({
  organizationId,
  roomId,
}: {
  organizationId: string;
  roomId: string;
}) => {
  const room = await prisma.room.findFirst({
    where: {
      id: roomId,
      apartment: { organizationId },
      deletedAt: null,
    },
    include: {
      apartment: { select: { id: true, name: true, location: true } },
      reservation: true,
      leases: {
        where: { status: 'ACTIVE', deletedAt: null },
        include: { fees: true, deposit: true },
      },
      meterReadings: {
        orderBy: { readingDate: 'desc' },
        take: 2,
        select: {
          meterType: true,
          readingDate: true,
          value: true,
        },
      },
    },
  });

  if (!room) {
    return null;
  }

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const bills = await prisma.bill.findMany({
    where: {
      lease: { roomId, organizationId },
      deletedAt: null,
      billingDate: {
        gte: monthStart,
        lt: new Date(today.getFullYear(), today.getMonth() + 1, 1),
      },
    },
    select: { id: true, status: true, totalAmount: true, mode: true },
  });

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
        deposit: activeLease.deposit
          ? {
              amount: Number(activeLease.deposit.amount),
              paidAmount: Number(activeLease.deposit.paidAmount),
              status: activeLease.deposit.status,
            }
          : null,
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
    currentMonthBills: bills.map((b) => ({
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
};

export const queryApartmentContractForAgent = async ({
  organizationId,
  apartmentId,
}: {
  organizationId: string;
  apartmentId: string;
}) => {
  const apartment = await prisma.apartment.findFirst({
    where: { id: apartmentId, organizationId },
    select: { id: true, name: true },
  });
  if (!apartment) {
    return null;
  }

  const contract = await prisma.apartmentContract.findUnique({
    where: { apartmentId },
  });

  return {
    apartmentId: apartment.id,
    apartmentName: apartment.name,
    contract: contract
      ? {
          landlordName: contract.landlordName,
          landlordPhone: contract.landlordPhone,
          contractStart: contract.contractStart
            ? contract.contractStart.toISOString().split('T')[0]
            : null,
          contractEnd: contract.contractEnd
            ? contract.contractEnd.toISOString().split('T')[0]
            : null,
          rentAmount: contract.rentAmount ? Number(contract.rentAmount) : null,
          floors: contract.floors,
          landArea: contract.landArea ? Number(contract.landArea) : null,
          totalArea: contract.totalArea ? Number(contract.totalArea) : null,
        }
      : null,
  };
};
