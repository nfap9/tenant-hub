import { prisma } from '../../config/prisma.js';

/**
 * 为 AI Agent 查询公寓列表，返回基础信息与房间统计
 * @param organizationId - 组织 ID
 * @param keyword - 搜索关键词（名称或地址）
 * @param limit - 返回数量上限，默认 20
 * @returns 精简后的公寓列表
 */
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

/**
 * 为 AI Agent 查询房间列表，支持按公寓、状态、关键词筛选
 * @param organizationId - 组织 ID
 * @param apartmentId - 所属公寓 ID（可选）
 * @param status - 房间状态（可选）
 * @param keyword - 搜索关键词（房号或户型）
 * @param limit - 返回数量上限，默认 30
 * @returns 精简后的房间列表
 */
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

/**
 * 为 AI Agent 查询房间详情，包含租约、账单与最近抄表记录
 * @param organizationId - 组织 ID
 * @param roomId - 房间 ID
 * @returns 房间详情对象，不存在返回 null
 */
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

/**
 * 为 AI Agent 查询公寓合同信息
 * @param organizationId - 组织 ID
 * @param apartmentId - 公寓 ID
 * @returns 公寓合同信息，不存在返回 null
 */
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
