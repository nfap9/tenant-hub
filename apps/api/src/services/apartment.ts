import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { HttpError } from '../utils/http.js';
import { enforceOrganizationQuota } from './quotas.js';

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
 * 列出组织下的所有公寓，包含房间、租约、账单等关联信息
 * @param organizationId - 组织 ID
 * @returns 公寓列表（含关联数据）
 */
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

/**
 * 创建新公寓（先校验组织配额）
 * @param data - 公寓数据
 * @param data.name - 公寓名称
 * @param data.location - 公寓地址
 * @param data.organizationId - 所属组织 ID
 * @returns 创建的公寓记录
 */
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

/**
 * 更新指定公寓的基本信息
 * @param apartmentId - 公寓 ID
 * @param data - 部分更新的字段（name / location）
 * @returns 更新后的公寓记录
 */
export const updateApartment = async (
  apartmentId: string,
  data: Partial<Pick<Prisma.ApartmentCreateInput, 'name' | 'location'>>
) => {
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
 * 创建公寓支出记录
 * @param data - 支出数据
 * @param data.apartmentId - 公寓 ID
 * @param data.name - 支出项目名
 * @param data.amount - 支出金额
 * @param data.spentAt - 支出日期
 * @param data.note - 备注（可选）
 * @returns 创建的支出记录
 */
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
 * 批量创建房间（带配额校验与去重）
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

/**
 * 更新指定房间的信息
 * @param roomId - 房间 ID
 * @param data - 部分更新的字段（roomNo / layout / area / facilities / status）
 * @returns 更新后的房间记录
 */
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
