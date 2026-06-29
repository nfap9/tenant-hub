import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { HttpError } from '../utils/http.js';

/**
 * 确保指定公寓属于当前组织，不存在则抛出 404 错误
 * @param apartmentId - 公寓 ID
 * @param organizationId - 组织 ID
 */
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

/**
 * 确保指定房间属于当前组织，不存在则抛出 404 错误
 * @param roomId - 房间 ID
 * @param organizationId - 组织 ID
 */
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

/**
 * 列出组织下的所有公寓，包含房间、租约等关联信息
 * @param organizationId - 组织 ID
 * @returns 公寓列表（含关联数据）
 */
export const listApartments = async (organizationId: string) => {
  return prisma.apartment.findMany({
    where: { organizationId },
    include: {
      rooms: {
        include: {
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
    },
    orderBy: { createdAt: 'desc' },
  });
};

type ApartmentWithRoomStats = Prisma.ApartmentGetPayload<{
  include: {
    _count: { select: { rooms: { where: { deletedAt: null } } } };
    rooms: { where: { deletedAt: null }; select: { status: true } };
  };
}>;

/**
 * 查询公寓原始数据（供复用）
 * @param organizationId - 组织 ID
 * @param options - 可选筛选与统计选项
 * @returns 公寓原始记录列表
 */
export async function listApartmentsRaw(
  organizationId: string,
  options: { keyword?: string; limit?: number; includeRoomStats: true }
): Promise<ApartmentWithRoomStats[]>;
export async function listApartmentsRaw(
  organizationId: string,
  options?: { keyword?: string; limit?: number; includeRoomStats?: boolean }
): Promise<import('@prisma/client').Apartment[]>;
export async function listApartmentsRaw(
  organizationId: string,
  options?: { keyword?: string; limit?: number; includeRoomStats?: boolean }
) {
  const roomStatsInclude = options?.includeRoomStats
    ? {
        _count: { select: { rooms: { where: { deletedAt: null } } } },
        rooms: {
          where: { deletedAt: null },
          select: { status: true },
        },
      }
    : undefined;

  return prisma.apartment.findMany({
    where: {
      organizationId,
      deletedAt: null,
      ...(options?.keyword
        ? {
            OR: [
              { name: { contains: options.keyword, mode: 'insensitive' } },
              { address: { contains: options.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    ...(roomStatsInclude ? { include: roomStatsInclude } : {}),
    take: options?.limit,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * 列出组织下的所有房间，包含所属公寓和活跃租约信息
 * @param organizationId - 组织 ID
 * @returns 房间列表（含关联数据）
 */
export const listRooms = async (organizationId: string) => {
  return prisma.room.findMany({
    where: { apartment: { organizationId } },
    include: {
      apartment: true,
      leases: {
        include: {
          fees: true,
          deposits: true,
          bills: {
            select: { id: true, status: true, billingDate: true },
          },
        },
        orderBy: { startDate: 'desc' },
      },
    },
    orderBy: [{ apartment: { createdAt: 'desc' } }, { roomNo: 'asc' }],
  });
};

/**
 * 查询房间原始数据（供复用）
 * @param organizationId - 组织 ID
 * @param options - 可选筛选条件
 * @returns 房间原始记录列表
 */
export const listRoomsRaw = async (
  organizationId: string,
  options?: {
    apartmentId?: string;
    status?: 'VACANT' | 'RESERVED' | 'OCCUPIED' | 'MAINTENANCE' | 'SELF_USE';
    keyword?: string;
    limit?: number;
  }
) => {
  return prisma.room.findMany({
    where: {
      apartment: { organizationId },
      deletedAt: null,
      ...(options?.apartmentId ? { apartmentId: options.apartmentId } : {}),
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.keyword
        ? {
            OR: [
              { roomNo: { contains: options.keyword, mode: 'insensitive' } },
              { layout: { contains: options.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: { apartment: { select: { name: true } } },
    take: options?.limit,
    orderBy: [{ apartment: { createdAt: 'desc' } }, { roomNo: 'asc' }],
  });
};

/**
 * 根据 ID 获取指定房间的详细信息
 * @param roomId - 房间 ID
 * @param organizationId - 组织 ID
 * @returns 房间详情（含关联数据），不存在返回 null
 */
export const getRoomById = async (roomId: string, organizationId: string) => {
  return prisma.room.findFirst({
    where: {
      id: roomId,
      apartment: { organizationId },
    },
    include: {
      apartment: true,
      leases: {
        where: { status: 'ACTIVE' },
        include: {
          fees: true,
          deposits: true,
          bills: {
            select: { id: true, status: true, billingDate: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
};

/**
 * 获取房间原始详情（供复用）
 * @param roomId - 房间 ID
 * @param organizationId - 组织 ID
 * @returns 房间原始详情，不存在返回 null
 */
export const getRoomByIdRaw = async (
  roomId: string,
  organizationId: string
) => {
  return prisma.room.findFirst({
    where: {
      id: roomId,
      apartment: { organizationId },
      deletedAt: null,
    },
    include: {
      apartment: { select: { id: true, name: true, address: true } },
      leases: {
        where: { status: 'ACTIVE', deletedAt: null },
        include: { fees: true, deposits: true },
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
};

/**
 * 校验指定组织下是否已存在同名公寓（不区分大小写，排除软删除）
 * @param organizationId - 组织 ID
 * @param name - 公寓名称
 * @param excludeId - 更新时需要排除的公寓 ID（可选）
 */
export const ensureApartmentNameUnique = async (
  organizationId: string,
  name: string,
  excludeId?: string
) => {
  const existing = await prisma.apartment.findFirst({
    where: {
      organizationId,
      name: { equals: name, mode: 'insensitive' },
      deletedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) throw new HttpError(409, '公寓名称已存在');
};

type ApartmentEditableFields = Partial<
  Pick<
    Prisma.ApartmentCreateInput,
    | 'name'
    | 'address'
    | 'rentAmount'
    | 'landlordName'
    | 'landlordPhone'
    | 'contractStart'
    | 'contractEnd'
    | 'floors'
  >
>;

/**
 * 创建新公寓
 * @param data - 公寓数据
 * @param data.name - 公寓名称
 * @param data.address - 公寓地址
 * @param data.organizationId - 所属组织 ID
 * @returns 创建的公寓记录
 */
export const createApartment = async (
  data: {
    name: string;
    address: string;
    organizationId: string;
  } & ApartmentEditableFields
) => {
  return prisma.$transaction(async (tx) => {
    await ensureApartmentNameUnique(data.organizationId, data.name);
    return tx.apartment.create({
      data: {
        name: data.name,
        address: data.address,
        organizationId: data.organizationId,
        rentAmount: data.rentAmount ?? 0,
        landlordName: data.landlordName,
        landlordPhone: data.landlordPhone,
        contractStart: data.contractStart,
        contractEnd: data.contractEnd,
        floors: data.floors,
      },
    });
  });
};

/**
 * 更新指定公寓的基本信息
 * @param apartmentId - 公寓 ID
 * @param organizationId - 所属组织 ID
 * @param data - 部分更新的字段
 * @returns 更新后的公寓记录
 */
export const updateApartment = async (
  apartmentId: string,
  organizationId: string,
  data: ApartmentEditableFields
) => {
  if (data.name) {
    await ensureApartmentNameUnique(organizationId, data.name, apartmentId);
  }
  return prisma.apartment.update({
    where: { id: apartmentId },
    data,
  });
};

/**
 * 删除指定公寓
 * @param apartmentId - 公寓 ID
 * @returns 被删除的公寓记录
 */
export const deleteApartment = async (apartmentId: string) => {
  return prisma.apartment.delete({ where: { id: apartmentId } });
};

/**
 * 统计指定公寓下的活跃租约数量
 * @param apartmentId - 公寓 ID
 * @param organizationId - 组织 ID
 * @returns 活跃租约数量
 */
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

/**
 * 根据 ID 获取公寓名称
 * @param apartmentId - 公寓 ID
 * @returns 公寓名称，不存在返回 undefined
 */
export const getApartmentName = async (apartmentId: string) => {
  const apartment = await prisma.apartment.findUnique({
    where: { id: apartmentId },
    select: { name: true },
  });
  return apartment?.name;
};

/**
 * 批量创建房间（带去重）
 * @param apartmentId - 所属公寓 ID
 * @param organizationId - 组织 ID
 * @param rooms - 房间列表
 * @returns Prisma createMany 结果
 */
export const batchCreateRooms = async (
  apartmentId: string,
  organizationId: string,
  rooms: Array<{
    roomNo: string;
    layout: string;
    area?: number;
    floor?: number;
    furnishings: string[];
  }>
) => {
  return prisma.$transaction(async (tx) => {
    const existingRooms = await tx.room.findMany({
      where: { apartment: { organizationId } },
      select: { apartmentId: true, roomNo: true },
    });
    const existingKeys = new Set(
      existingRooms.map((room) => `${room.apartmentId}:${room.roomNo}`)
    );
    const newRooms = rooms.filter(
      (room) => !existingKeys.has(`${apartmentId}:${room.roomNo}`)
    );
    return tx.room.createMany({
      data: newRooms.map((room) => ({
        ...room,
        apartmentId,
      })),
      skipDuplicates: true,
    });
  });
};

/**
 * 更新指定房间的信息
 * @param roomId - 房间 ID
 * @param data - 部分更新的字段（roomNo / layout / area / floor / furnishings / status）
 * @returns 更新后的房间记录
 */
export const updateRoom = async (
  roomId: string,
  data: Partial<{
    roomNo: string;
    layout: string;
    area: number;
    floor: number;
    furnishings: string[];
    status: 'VACANT' | 'RESERVED' | 'OCCUPIED' | 'MAINTENANCE' | 'SELF_USE';
  }>
) => {
  return prisma.room.update({
    where: { id: roomId },
    data,
  });
};

/**
 * 获取指定房间的状态
 * @param roomId - 房间 ID
 * @returns 房间状态，不存在返回 undefined
 */
export const getRoomStatus = async (roomId: string) => {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { status: true },
  });
  return room?.status;
};

/**
 * 统计指定房间下的活跃租约数量
 * @param roomId - 房间 ID
 * @param organizationId - 组织 ID
 * @returns 活跃租约数量
 */
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

/**
 * 删除指定房间
 * @param roomId - 房间 ID
 * @returns 被删除的房间记录
 */
export const deleteRoom = async (roomId: string) => {
  return prisma.room.delete({ where: { id: roomId } });
};
