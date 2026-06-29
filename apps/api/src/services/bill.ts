import { prisma } from '../config/prisma.js';
import { HttpError } from '../utils/http.js';
import { calculateUtilityLineAmounts, refreshBillTotals } from './billing.js';

/**
 * 查询账单列表
 * @param organizationId - 组织ID
 * @param status - 账单状态筛选（可选）
 * @returns 账单列表，包含租约、房间、账单项目和付款信息
 */
export const listBills = async (
  organizationId: string,
  status?: 'UNPAID' | 'PAID' | 'VOID'
) => {
  return prisma.bill.findMany({
    where: {
      organizationId,
      ...(status ? { status } : {}),
    },
    include: {
      lease: { include: { room: true } },
      items: true,
      payments: true,
    },
    orderBy: { dueDate: 'asc' },
  });
};

/**
 * 查询账单原始数据（供复用）
 * @param organizationId - 组织ID
 * @param options - 可选筛选条件
 * @returns 账单原始记录列表
 */
export const listBillsRaw = async (
  organizationId: string,
  options?: {
    status?: 'UNPAID' | 'PAID' | 'VOID';
    tenantName?: string;
    limit?: number;
  }
) => {
  return prisma.bill.findMany({
    where: {
      organizationId,
      deletedAt: null,
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.tenantName
        ? {
            lease: {
              tenantName: { contains: options.tenantName, mode: 'insensitive' },
            },
          }
        : {}),
    },
    include: {
      lease: {
        select: {
          tenantName: true,
          room: { select: { roomNo: true } },
        },
      },
      items: true,
      payments: {
        include: { user: { select: { username: true } } },
        orderBy: { id: 'desc' },
      },
    },
    take: options?.limit,
    orderBy: { billingDate: 'desc' },
  });
};

/**
 * 根据ID获取账单详情
 * @param billId - 账单ID
 * @param organizationId - 组织ID
 * @returns 账单详情，包含账单项目和付款记录
 */
export const getBillById = async (billId: string, organizationId: string) => {
  return prisma.bill.findFirst({
    where: { id: billId, organizationId },
    include: {
      lease: { include: { room: true } },
      items: true,
      payments: true,
    },
  });
};

/**
 * 根据ID查找租约
 * @param leaseId - 租约ID
 * @param organizationId - 组织ID
 * @returns 租约基本信息（仅ID）
 */
export const findLeaseById = async (
  leaseId: string,
  organizationId: string
) => {
  return prisma.lease.findFirst({
    where: { id: leaseId, organizationId },
    select: { id: true },
  });
};

/**
 * 查询抄表记录列表
 * @param organizationId - 组织ID
 * @param roomId - 房间ID（可选）
 * @returns 抄表记录列表，包含房间、租约信息
 */
export const listMeterReadings = async (
  organizationId: string,
  filters?: {
    roomId?: string;
    apartmentId?: string;
    meterType?: 'WATER' | 'POWER';
    startDate?: Date;
    endDate?: Date;
  }
) => {
  return prisma.meterReading.findMany({
    where: {
      organizationId,
      ...(filters?.roomId ? { roomId: filters.roomId } : {}),
      ...(filters?.apartmentId ? { apartmentId: filters.apartmentId } : {}),
      ...(filters?.meterType ? { meterType: filters.meterType } : {}),
      ...(filters?.startDate || filters?.endDate
        ? {
            readingDate: {
              ...(filters.startDate ? { gte: filters.startDate } : {}),
              ...(filters.endDate ? { lte: filters.endDate } : {}),
            },
          }
        : {}),
    },
    include: {
      room: true,
      lease: true,
      apartment: true,
    },
    orderBy: { readingDate: 'desc' },
  });
};

/**
 * 查询抄表记录原始数据（供复用）
 * @param organizationId - 组织ID
 * @param options - 可选筛选条件
 * @returns 抄表记录原始列表
 */
export const listMeterReadingsRaw = async (
  organizationId: string,
  options?: {
    roomId?: string;
    meterType?: 'WATER' | 'POWER';
    limit?: number;
  }
) => {
  return prisma.meterReading.findMany({
    where: {
      organizationId,
      ...(options?.roomId ? { roomId: options.roomId } : {}),
      ...(options?.meterType ? { meterType: options.meterType } : {}),
    },
    include: {
      room: {
        select: {
          roomNo: true,
          apartment: { select: { name: true } },
        },
      },
    },
    take: options?.limit,
    orderBy: { readingDate: 'desc' },
  });
};

/**
 * 查询待抄表房间列表（有活跃租约的房间及其最近一次抄表读数）
 * @param organizationId - 组织ID
 * @returns 待抄表房间列表
 */
export const listMeterReadingRooms = async (organizationId: string) => {
  const leases = await prisma.lease.findMany({
    where: {
      organizationId,
      status: 'ACTIVE',
    },
    include: {
      room: {
        include: { apartment: true },
      },
    },
    orderBy: { startDate: 'desc' },
  });

  const roomIds = leases.map((lease) => lease.roomId);
  if (roomIds.length === 0) return [];

  const [latestWaterReadings, latestPowerReadings] = await Promise.all([
    prisma.meterReading.findMany({
      where: {
        organizationId,
        roomId: { in: roomIds },
        meterType: 'WATER',
      },
      orderBy: [{ roomId: 'asc' }, { readingDate: 'desc' }],
      distinct: ['roomId'],
    }),
    prisma.meterReading.findMany({
      where: {
        organizationId,
        roomId: { in: roomIds },
        meterType: 'POWER',
      },
      orderBy: [{ roomId: 'asc' }, { readingDate: 'desc' }],
      distinct: ['roomId'],
    }),
  ]);

  const readingMap = new Map<
    string,
    Map<'WATER' | 'POWER', { readingDate: Date; value: number }>
  >();
  for (const reading of [...latestWaterReadings, ...latestPowerReadings]) {
    if (!readingMap.has(reading.roomId)) {
      readingMap.set(reading.roomId, new Map());
    }
    readingMap.get(reading.roomId)!.set(reading.meterType, {
      readingDate: reading.readingDate,
      value: Number(reading.value),
    });
  }

  return leases.map((lease) => {
    const roomReadings = readingMap.get(lease.roomId) ?? new Map();
    const water = roomReadings.get('WATER');
    const power = roomReadings.get('POWER');
    return {
      leaseId: lease.id,
      tenantName: lease.tenantName,
      roomId: lease.roomId,
      roomNo: lease.room.roomNo,
      apartmentId: lease.room.apartmentId,
      apartmentName: lease.room.apartment.name,
      lastWaterReadingDate: water?.readingDate ?? null,
      lastWaterValue: water?.value ?? null,
      lastPowerReadingDate: power?.readingDate ?? null,
      lastPowerValue: power?.value ?? null,
    };
  });
};

/**
 * 查找用于抄表的房间
 * @param roomId - 房间ID
 * @param organizationId - 组织ID
 * @returns 房间信息，包含所属公寓
 */
export const findRoomForMeterReading = async (
  roomId: string,
  organizationId: string
) => {
  return prisma.room.findFirst({
    where: {
      id: roomId,
      apartment: { organizationId },
    },
    include: { apartment: true },
  });
};

/**
 * 查找用于抄表的租约
 * @param roomId - 房间ID
 * @param organizationId - 组织ID
 * @param readingDate - 抄表日期
 * @returns 在抄表日期范围内生效的租约
 */
export const findLeaseForMeterReading = async (
  roomId: string,
  organizationId: string,
  readingDate: Date
) => {
  return prisma.lease.findFirst({
    where: {
      roomId,
      organizationId,
      startDate: { lte: readingDate },
      endDate: { gte: readingDate },
    },
    orderBy: { startDate: 'desc' },
  });
};

/**
 * 创建抄表记录
 * @param data - 抄表记录数据
 * @returns 创建的抄表记录
 */
export const createMeterReading = async (data: {
  organizationId: string;
  apartmentId: string;
  roomId: string;
  leaseId?: string;
  meterType: 'WATER' | 'POWER';
  readingDate: Date;
  value: number;
  note?: string;
}) => {
  return prisma.meterReading.create({ data });
};

/**
 * 查找房间待处理的后付费账单
 * @param roomId - 房间ID
 * @returns 待处理的后付费账单ID列表
 */
export const findPendingPostpaidBillsByRoom = async (roomId: string) => {
  return prisma.bill.findMany({
    where: {
      lease: { roomId },
      status: 'UNPAID',
      items: {
        some: {
          category: 'UTILITY',
          amount: 0,
        },
      },
    },
    select: { id: true },
  });
};

/**
 * 获取账单及其项目和租约信息
 * @param billId - 账单ID
 * @param organizationId - 组织ID
 * @returns 账单详情，包含租约、房间和账单项目
 */
export const getBillWithItemsAndLease = async (
  billId: string,
  organizationId: string
) => {
  return prisma.bill.findFirst({
    where: { id: billId, organizationId },
    include: { lease: { include: { room: true } }, items: true },
  });
};

/**
 * 将水电读数应用到后付费账单
 * @param billId - 账单ID
 * @param organizationId - 组织ID
 * @param userId - 操作用户ID
 * @param previousWater - 上期水表读数
 * @param currentWater - 本期水表读数
 * @param previousPower - 上期电表读数
 * @param currentPower - 本期电表读数
 * @returns 更新后的账单（包含账单项目）
 */
export const applyUtilityReadingToBill = async ({
  billId,
  organizationId,
  userId: _userId,
  previousWater,
  currentWater,
  previousPower,
  currentPower,
}: {
  billId: string;
  organizationId: string;
  userId: string;
  previousWater: number;
  currentWater: number;
  previousPower: number;
  currentPower: number;
}) => {
  const bill = await getBillWithItemsAndLease(billId, organizationId);
  if (!bill) throw new HttpError(404, '账单不存在');
  const waterItem = bill.items.find(
    (item) => item.category === 'UTILITY' && item.name === '水费'
  );
  const powerItem = bill.items.find(
    (item) => item.category === 'UTILITY' && item.name === '电费'
  );
  if (!waterItem || !powerItem) throw new HttpError(400, '账单缺少水电项目');
  if (currentWater < previousWater)
    throw new HttpError(400, '水表本期读数不能小于上期读数');
  if (currentPower < previousPower)
    throw new HttpError(400, '电表本期读数不能小于上期读数');

  const { waterAmount, powerAmount } = calculateUtilityLineAmounts({
    previousWater,
    currentWater,
    waterUnitPrice: bill.lease.waterUnitPrice,
    previousPower,
    currentPower,
    powerUnitPrice: bill.lease.powerUnitPrice,
  });

  await prisma.$transaction([
    prisma.billItem.update({
      where: { id: waterItem.id },
      data: { amount: waterAmount },
    }),
    prisma.billItem.update({
      where: { id: powerItem.id },
      data: { amount: powerAmount },
    }),
    prisma.bill.update({
      where: { id: bill.id },
      data: { status: 'UNPAID' },
    }),
    prisma.meterReading.createMany({
      data: [
        {
          organizationId: bill.organizationId,
          apartmentId: bill.lease.room.apartmentId,
          roomId: bill.lease.roomId,
          leaseId: bill.leaseId,
          meterType: 'WATER',
          readingDate: waterItem.periodStart,
          value: previousWater,
        },
        {
          organizationId: bill.organizationId,
          apartmentId: bill.lease.room.apartmentId,
          roomId: bill.lease.roomId,
          leaseId: bill.leaseId,
          meterType: 'WATER',
          readingDate: waterItem.periodEnd,
          value: currentWater,
        },
        {
          organizationId: bill.organizationId,
          apartmentId: bill.lease.room.apartmentId,
          roomId: bill.lease.roomId,
          leaseId: bill.leaseId,
          meterType: 'POWER',
          readingDate: powerItem.periodStart,
          value: previousPower,
        },
        {
          organizationId: bill.organizationId,
          apartmentId: bill.lease.room.apartmentId,
          roomId: bill.lease.roomId,
          leaseId: bill.leaseId,
          meterType: 'POWER',
          readingDate: powerItem.periodEnd,
          value: currentPower,
        },
      ],
    }),
  ]);

  await refreshBillTotals(bill.id);
  return prisma.bill.findUnique({
    where: { id: bill.id },
    include: { items: true },
  });
};

/**
 * 获取用于重试的账单
 * @param billId - 账单ID
 * @param organizationId - 组织ID
 * @returns 账单基本信息
 */
export const getBillForRetry = async (
  billId: string,
  organizationId: string
) => {
  return prisma.bill.findFirst({
    where: { id: billId, organizationId },
    include: { items: true },
  });
};

/**
 * 删除账单及其关联付款记录
 * @param billId - 账单ID
 * @returns 无返回值
 */
export const deleteBillWithPayments = async (billId: string) => {
  await prisma.$transaction([
    prisma.payment.deleteMany({ where: { billId } }),
    prisma.bill.delete({ where: { id: billId } }),
  ]);
};
