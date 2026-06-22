import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { startOfLeaseDay, withLeaseLifecycle } from './leaseLifecycle.js';

const leaseInclude = {
  room: { include: { apartment: true } },
  fees: true,
  deposits: true,
} as const;

export type DepositAllocation = {
  roomOffset: Prisma.Decimal;
  keyOffset: Prisma.Decimal;
};

/**
 * 将预留定金优先抵扣房间押金，剩余部分抵扣钥匙押金
 * @param reservationDeposit - 预留定金金额
 * @param roomDepositAmount - 房间押金金额
 * @param keyDepositAmount - 钥匙押金金额
 * @returns 房间押金抵扣额与钥匙押金抵扣额
 */
export const allocateReservationOffset = (
  reservationDeposit: Prisma.Decimal.Value,
  roomDepositAmount: Prisma.Decimal.Value,
  keyDepositAmount: Prisma.Decimal.Value
): DepositAllocation => {
  const total = new Prisma.Decimal(reservationDeposit);
  const room = new Prisma.Decimal(roomDepositAmount);
  const key = new Prisma.Decimal(keyDepositAmount);

  const roomOffset = total.lessThanOrEqualTo(room) ? total : room;
  const remaining = total.minus(roomOffset);
  const keyOffset = remaining.lessThanOrEqualTo(key) ? remaining : key;

  return { roomOffset, keyOffset };
};

type DepositType = 'ROOM' | 'KEY';

/**
 * 为指定类型的押金生成押金账单、支付记录及 Deposit 记录
 * @param tx - Prisma 事务客户端
 * @param data - 押金账单创建数据
 * @returns 创建的押金记录
 */
async function createDepositBillAndRecord(
  tx: Prisma.TransactionClient,
  data: {
    lease: {
      id: string;
      roomId: string;
      startDate: Date;
      endDate: Date;
      room: { apartmentId: string };
    };
    organizationId: string;
    userId: string;
    depositType: DepositType;
    amount: Prisma.Decimal;
    offset: Prisma.Decimal;
    reservationPaymentMethod?: string | null;
  }
) {
  const {
    lease,
    organizationId,
    userId,
    depositType,
    amount,
    offset,
    reservationPaymentMethod,
  } = data;

  if (amount.lessThanOrEqualTo(0)) return null;

  const netAmount = amount.minus(offset);
  const typeLabel = depositType === 'ROOM' ? '房间押金' : '钥匙押金';

  const bill = await tx.bill.create({
    data: {
      organizationId,
      leaseId: lease.id,
      mode: 'DEPOSIT',
      billingDate: startOfLeaseDay(lease.startDate).toDate(),
      periodStart: startOfLeaseDay(lease.startDate).toDate(),
      periodEnd: startOfLeaseDay(lease.endDate).toDate(),
      dueDate: startOfLeaseDay(lease.startDate).toDate(),
      status: netAmount.lessThanOrEqualTo(0) ? 'PAID' : 'UNPAID',
      totalAmount: netAmount,
      paidAmount: offset,
      note: offset.greaterThan(0) ? '预留定金已抵扣' : undefined,
      items: {
        create: [
          {
            type: 'DEPOSIT',
            name: offset.greaterThan(0)
              ? `${typeLabel}（预留定金已抵扣）`
              : typeLabel,
            amount: netAmount,
            status: netAmount.lessThanOrEqualTo(0) ? 'PAID' : 'UNPAID',
          },
        ],
      },
    },
  });

  if (offset.greaterThan(0)) {
    await tx.payment.create({
      data: {
        billId: bill.id,
        userId,
        type: 'DEDUCT',
        amount: offset,
        method: reservationPaymentMethod || '预留定金抵扣',
        note: '预留定金转押金',
        status: 'COMPLETED',
      },
    });
  }

  return tx.deposit.create({
    data: {
      organizationId,
      leaseId: lease.id,
      billId: bill.id,
      type: depositType,
      amount,
      paidAmount: offset,
      status: offset.greaterThan(0) ? 'PAID' : 'UNPAID',
    },
  });
}

/**
 * 获取指定组织下的所有租约列表
 * @param organizationId - 组织 ID
 * @returns 带生命周期状态的租约列表
 */
export const listLeases = async (organizationId: string) => {
  const leases = await prisma.lease.findMany({
    where: { organizationId },
    include: leaseInclude,
    orderBy: { createdAt: 'desc' },
  });
  return leases.map((lease) => withLeaseLifecycle(lease));
};

/**
 * 查询租约原始数据（供 Agent 复用）
 * @param organizationId - 组织 ID
 * @param options - 可选筛选条件
 * @returns 租约原始记录列表
 */
export const listLeasesRaw = async (
  organizationId: string,
  options?: {
    tenantName?: string;
    roomId?: string;
    status?: 'ACTIVE' | 'TERMINATED' | 'EXPIRED' | 'DRAFT';
    limit?: number;
  }
) => {
  return prisma.lease.findMany({
    where: {
      organizationId,
      deletedAt: null,
      ...(options?.tenantName
        ? {
            tenantName: { contains: options.tenantName, mode: 'insensitive' },
          }
        : {}),
      ...(options?.roomId ? { roomId: options.roomId } : {}),
      ...(options?.status ? { status: options.status } : {}),
    },
    include: {
      room: { include: { apartment: { select: { name: true } } } },
      fees: true,
      deposits: true,
    },
    take: options?.limit,
    orderBy: { createdAt: 'desc' },
  });
};

/**
 * 根据 ID 获取租约
 * @param leaseId - 租约 ID
 * @param organizationId - 组织 ID
 * @returns 租约详情（包含费用信息）
 */
export const getLeaseById = async (leaseId: string, organizationId: string) => {
  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, organizationId },
    include: { fees: true },
  });
  return lease;
};

/**
 * 根据 ID 查找房间
 * @param roomId - 房间 ID
 * @param organizationId - 组织 ID
 * @returns 房间基本信息（ID 和状态）
 */
export const findRoomById = async (roomId: string, organizationId: string) => {
  return prisma.room.findFirst({
    where: { id: roomId, apartment: { organizationId } },
    select: { id: true, status: true },
  });
};

/**
 * 计算钥匙押金金额
 * @param keyQuantity - 钥匙数量
 * @param keyUnitPrice - 钥匙单价
 * @returns 钥匙押金金额
 */
export const calculateKeyDepositAmount = (
  keyQuantity: Prisma.Decimal.Value,
  keyUnitPrice: Prisma.Decimal.Value
) => {
  return new Prisma.Decimal(keyQuantity).mul(new Prisma.Decimal(keyUnitPrice));
};

/**
 * 计算总押金金额
 * @param roomDepositAmount - 房间押金
 * @param keyQuantity - 钥匙数量
 * @param keyUnitPrice - 钥匙单价
 * @returns 总押金金额
 */
export const calculateTotalDepositAmount = (
  roomDepositAmount: Prisma.Decimal.Value,
  keyQuantity: Prisma.Decimal.Value,
  keyUnitPrice: Prisma.Decimal.Value
) => {
  return new Prisma.Decimal(roomDepositAmount).plus(
    calculateKeyDepositAmount(keyQuantity, keyUnitPrice)
  );
};

/**
 * 创建租约并生成押金账单（含预留定金抵扣逻辑）
 * @param data - 租约创建数据，包含租约信息、房间 ID、组织 ID、用户 ID 及费用列表
 * @returns 创建完成的租约详情（含房间、费用、押金信息）
 */
export const createLeaseWithDeposit = async (data: {
  leaseData: {
    tenantName?: string;
    tenantPhone?: string;
    startDate: Date;
    endDate: Date;
    cycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    rentAmount: Prisma.Decimal.Value;
    depositAmount: Prisma.Decimal.Value;
    roomDepositAmount: Prisma.Decimal.Value;
    keyQuantity: number;
    keyUnitPrice: Prisma.Decimal.Value;
    waterUnitPrice: Prisma.Decimal.Value;
    powerUnitPrice: Prisma.Decimal.Value;
    autoRenew: boolean;
    status: 'DRAFT' | 'ACTIVE';
  };
  roomId: string;
  organizationId: string;
  userId: string;
  fees: Array<{
    type:
      | 'MANAGEMENT'
      | 'SANITATION'
      | 'ELEVATOR'
      | 'PROPERTY'
      | 'NETWORK'
      | 'OTHER';
    name: string;
    amount: Prisma.Decimal.Value;
  }>;
}) => {
  const { leaseData, roomId, organizationId, userId, fees } = data;
  return prisma.$transaction(async (tx) => {
    const created = await tx.lease.create({
      data: {
        ...leaseData,
        organizationId,
        roomId,
        status: leaseData.status,
        fees: { create: fees },
      },
      include: { room: { include: { apartment: true } }, fees: true },
    });

    if (leaseData.status === 'ACTIVE') {
      const reservation = await tx.reservation.findUnique({
        where: { roomId },
      });
      const reservationDeposit =
        reservation && reservation.deposit.greaterThan(0)
          ? reservation.deposit
          : new Prisma.Decimal(0);

      const roomDepositAmount = new Prisma.Decimal(leaseData.roomDepositAmount);
      const keyDepositAmount = calculateKeyDepositAmount(
        leaseData.keyQuantity,
        leaseData.keyUnitPrice
      );

      const { roomOffset, keyOffset } = allocateReservationOffset(
        reservationDeposit,
        roomDepositAmount,
        keyDepositAmount
      );

      await createDepositBillAndRecord(tx, {
        lease: created,
        organizationId,
        userId,
        depositType: 'ROOM',
        amount: roomDepositAmount,
        offset: roomOffset,
        reservationPaymentMethod: reservation?.paymentMethod,
      });

      await createDepositBillAndRecord(tx, {
        lease: created,
        organizationId,
        userId,
        depositType: 'KEY',
        amount: keyDepositAmount,
        offset: keyOffset,
        reservationPaymentMethod: reservation?.paymentMethod,
      });

      if (reservation) {
        await tx.reservation.delete({ where: { roomId } });
      }
    }

    return tx.lease.findUniqueOrThrow({
      where: { id: created.id },
      include: leaseInclude,
    });
  });
};

/**
 * 创建租约但不生成押金账单
 * @param data - 租约创建数据，包含租约信息、房间 ID、组织 ID 及费用列表
 * @returns 创建完成的租约详情（含房间、费用、押金信息）
 */
export const createLeaseWithoutDeposit = async (data: {
  leaseData: {
    tenantName?: string;
    tenantPhone?: string;
    startDate: Date;
    endDate: Date;
    cycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    rentAmount: Prisma.Decimal.Value;
    depositAmount: Prisma.Decimal.Value;
    roomDepositAmount: Prisma.Decimal.Value;
    keyQuantity: number;
    keyUnitPrice: Prisma.Decimal.Value;
    waterUnitPrice: Prisma.Decimal.Value;
    powerUnitPrice: Prisma.Decimal.Value;
    autoRenew: boolean;
    status: 'DRAFT' | 'ACTIVE';
  };
  roomId: string;
  organizationId: string;
  fees: Array<{
    type:
      | 'MANAGEMENT'
      | 'SANITATION'
      | 'ELEVATOR'
      | 'PROPERTY'
      | 'NETWORK'
      | 'OTHER';
    name: string;
    amount: Prisma.Decimal.Value;
  }>;
}) => {
  return prisma.lease.create({
    data: {
      ...data.leaseData,
      organizationId: data.organizationId,
      roomId: data.roomId,
      status: data.leaseData.status,
      fees: { create: data.fees },
    },
    include: leaseInclude,
  });
};

/**
 * 更新房间状态
 * @param roomId - 房间 ID
 * @param status - 新状态（空闲/已预订/已入住/维修中）
 * @returns 更新后的房间信息
 */
export const updateRoomStatus = async (
  roomId: string,
  status: 'VACANT' | 'RESERVED' | 'OCCUPIED' | 'MAINTENANCE' | 'SELF_USE'
) => {
  return prisma.room.update({
    where: { id: roomId },
    data: { status },
  });
};

/**
 * 更新租约信息及费用
 * @param leaseId - 租约 ID
 * @param data - 更新的租约数据和费用列表
 * @returns 更新后的租约详情（含房间、费用、押金信息）
 */
export const updateLease = async (
  leaseId: string,
  data: {
    leaseData: Partial<{
      rentAmount: Prisma.Decimal.Value;
      depositAmount: Prisma.Decimal.Value;
      roomDepositAmount: Prisma.Decimal.Value;
      keyQuantity: number;
      keyUnitPrice: Prisma.Decimal.Value;
      waterUnitPrice: Prisma.Decimal.Value;
      powerUnitPrice: Prisma.Decimal.Value;
    }>;
    fees?: Array<{
      type:
        | 'MANAGEMENT'
        | 'SANITATION'
        | 'ELEVATOR'
        | 'PROPERTY'
        | 'NETWORK'
        | 'OTHER';
      name: string;
      amount: Prisma.Decimal.Value;
    }>;
  }
) => {
  return prisma.$transaction(async (tx) => {
    if (data.fees) {
      await tx.leaseFee.deleteMany({ where: { leaseId } });
      await tx.leaseFee.createMany({
        data: data.fees.map((fee) => ({ ...fee, leaseId })),
      });
    }

    const currentLease = await tx.lease.findUnique({
      where: { id: leaseId },
      select: {
        keyQuantity: true,
        keyUnitPrice: true,
      },
    });
    if (!currentLease) throw new Error('租约不存在');

    const currentDeposits = await tx.deposit.findMany({ where: { leaseId } });
    const roomDeposit = currentDeposits.find((d) => d.type === 'ROOM');
    const keyDeposit = currentDeposits.find((d) => d.type === 'KEY');

    if (data.leaseData.roomDepositAmount !== undefined) {
      const newRoomAmount = new Prisma.Decimal(
        data.leaseData.roomDepositAmount
      );
      if (
        roomDeposit &&
        roomDeposit.status === 'UNPAID' &&
        roomDeposit.billId
      ) {
        await tx.deposit.update({
          where: { id: roomDeposit.id },
          data: { amount: newRoomAmount },
        });
        await tx.billItem.updateMany({
          where: { billId: roomDeposit.billId },
          data: { amount: newRoomAmount, status: 'UNPAID' },
        });
        await tx.bill.update({
          where: { id: roomDeposit.billId },
          data: { totalAmount: newRoomAmount, paidAmount: 0, status: 'UNPAID' },
        });
      }
    }

    if (
      data.leaseData.keyQuantity !== undefined ||
      data.leaseData.keyUnitPrice !== undefined
    ) {
      const newKeyAmount = calculateKeyDepositAmount(
        data.leaseData.keyQuantity ?? currentLease.keyQuantity,
        data.leaseData.keyUnitPrice ?? currentLease.keyUnitPrice
      );
      if (keyDeposit && keyDeposit.status === 'UNPAID' && keyDeposit.billId) {
        await tx.deposit.update({
          where: { id: keyDeposit.id },
          data: { amount: newKeyAmount },
        });
        await tx.billItem.updateMany({
          where: { billId: keyDeposit.billId },
          data: { amount: newKeyAmount, status: 'UNPAID' },
        });
        await tx.bill.update({
          where: { id: keyDeposit.billId },
          data: { totalAmount: newKeyAmount, paidAmount: 0, status: 'UNPAID' },
        });
      }
    }

    return tx.lease.update({
      where: { id: leaseId },
      data: data.leaseData,
      include: leaseInclude,
    });
  });
};

/**
 * 获取租约及其费用信息
 * @param leaseId - 租约 ID
 * @param organizationId - 组织 ID
 * @returns 租约详情（包含费用信息）
 */
export const getLeaseWithFees = async (
  leaseId: string,
  organizationId: string
) => {
  return prisma.lease.findFirst({
    where: { id: leaseId, organizationId },
    include: { fees: true },
  });
};

/**
 * 激活草稿状态的租约
 * @param data - 包含租约 ID、组织 ID 和用户 ID
 * @returns 激活后的租约详情
 */
export const activateLease = async (data: {
  leaseId: string;
  organizationId: string;
  userId: string;
}) => {
  const { leaseId, organizationId, userId } = data;

  return prisma.$transaction(async (tx) => {
    const lease = await tx.lease.findUniqueOrThrow({
      where: { id: leaseId },
      include: { fees: true, room: { include: { apartment: true } } },
    });

    const roomDepositAmount = new Prisma.Decimal(lease.roomDepositAmount);
    const keyDepositAmount = calculateKeyDepositAmount(
      lease.keyQuantity,
      lease.keyUnitPrice
    );

    if (roomDepositAmount.greaterThan(0) || keyDepositAmount.greaterThan(0)) {
      const reservation = await tx.reservation.findUnique({
        where: { roomId: lease.roomId },
      });
      const reservationDeposit =
        reservation && reservation.deposit.greaterThan(0)
          ? reservation.deposit
          : new Prisma.Decimal(0);

      const { roomOffset, keyOffset } = allocateReservationOffset(
        reservationDeposit,
        roomDepositAmount,
        keyDepositAmount
      );

      await createDepositBillAndRecord(tx, {
        lease,
        organizationId,
        userId,
        depositType: 'ROOM',
        amount: roomDepositAmount,
        offset: roomOffset,
        reservationPaymentMethod: reservation?.paymentMethod,
      });

      await createDepositBillAndRecord(tx, {
        lease,
        organizationId,
        userId,
        depositType: 'KEY',
        amount: keyDepositAmount,
        offset: keyOffset,
        reservationPaymentMethod: reservation?.paymentMethod,
      });

      if (reservation) {
        await tx.reservation.delete({ where: { roomId: lease.roomId } });
      }
    }

    const updated = await tx.lease.update({
      where: { id: lease.id },
      data: { status: 'ACTIVE' },
      include: leaseInclude,
    });

    return updated;
  });
};

/**
 * 获取租约的结束日期
 * @param leaseId - 租约 ID
 * @param organizationId - 组织 ID
 * @returns 租约的 ID 和结束日期
 */
export const getLeaseEndDate = async (
  leaseId: string,
  organizationId: string
) => {
  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, organizationId },
    select: { id: true, endDate: true },
  });
  return lease;
};

/**
 * 获取指定组织下的所有租约退租结算列表
 * @param organizationId - 组织 ID
 * @returns 退租结算列表（含租约、房间、收款记录）
 */
export const listLeaseSettlements = async (organizationId: string) => {
  return prisma.leaseSettlement.findMany({
    where: { organizationId },
    include: {
      lease: { include: leaseInclude },
      room: true,
      payments: {
        include: {
          user: { select: { id: true, username: true, phone: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

/**
 * 查询退租结算原始数据（供 Agent 复用）
 * @param organizationId - 组织 ID
 * @param options - 可选筛选条件
 * @returns 退租结算原始记录列表
 */
export const listLeaseSettlementsRaw = async (
  organizationId: string,
  options?: {
    leaseId?: string;
    limit?: number;
  }
) => {
  return prisma.leaseSettlement.findMany({
    where: {
      organizationId,
      ...(options?.leaseId ? { leaseId: options.leaseId } : {}),
    },
    include: {
      lease: {
        select: {
          tenantName: true,
          tenantPhone: true,
          room: {
            select: {
              roomNo: true,
              apartment: { select: { name: true } },
            },
          },
        },
      },
      room: { select: { roomNo: true } },
      payments: {
        include: {
          user: { select: { username: true } },
        },
      },
      bill: {
        select: {
          totalAmount: true,
          paidAmount: true,
          status: true,
        },
      },
    },
    take: options?.limit,
    orderBy: { createdAt: 'desc' },
  });
};
