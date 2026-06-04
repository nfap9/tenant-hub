import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { startOfLeaseDay, withLeaseLifecycle } from './leaseLifecycle.js';

const leaseInclude = {
  room: { include: { apartment: true } },
  fees: true,
  deposit: true,
} as const;

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
 * 创建租约并生成押金账单（含预留定金抵扣逻辑）
 * @param data - 租约创建数据，包含租约信息、房间 ID、组织 ID、用户 ID 及费用列表
 * @returns 创建完成的租约详情（含房间、费用、押金信息）
 */
export const createLeaseWithDeposit = async (data: {
  leaseData: {
    tenantName: string;
    tenantPhone: string;
    startDate: Date;
    endDate: Date;
    cycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    rentAmount: Prisma.Decimal.Value;
    depositAmount: Prisma.Decimal.Value;
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
      const offset =
        reservation && reservation.deposit.greaterThan(0)
          ? reservation.deposit
          : new Prisma.Decimal(0);
      const netDeposit = new Prisma.Decimal(leaseData.depositAmount).minus(
        offset
      );

      const bill = await tx.bill.create({
        data: {
          organizationId,
          leaseId: created.id,
          mode: 'DEPOSIT',
          billingDate: startOfLeaseDay(leaseData.startDate).toDate(),
          periodStart: startOfLeaseDay(leaseData.startDate).toDate(),
          periodEnd: startOfLeaseDay(leaseData.endDate).toDate(),
          dueDate: startOfLeaseDay(leaseData.startDate).toDate(),
          status: netDeposit.lessThanOrEqualTo(0) ? 'PAID' : 'UNPAID',
          totalAmount: netDeposit,
          paidAmount: offset,
          note: offset.greaterThan(0) ? '预留定金已抵扣' : undefined,
          items: {
            create: [
              {
                type: 'DEPOSIT',
                name: offset.greaterThan(0) ? '押金（预留定金已抵扣）' : '押金',
                amount: netDeposit,
                status: netDeposit.lessThanOrEqualTo(0) ? 'PAID' : 'UNPAID',
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
            method: reservation?.paymentMethod || '预留定金抵扣',
            note: '预留定金转押金',
            status: 'COMPLETED',
          },
        });
      }

      await tx.deposit.create({
        data: {
          organizationId,
          leaseId: created.id,
          billId: bill.id,
          amount: leaseData.depositAmount,
          paidAmount: offset,
          status: offset.greaterThan(0) ? 'PAID' : 'UNPAID',
        },
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
    tenantName: string;
    tenantPhone: string;
    startDate: Date;
    endDate: Date;
    cycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    rentAmount: Prisma.Decimal.Value;
    depositAmount: Prisma.Decimal.Value;
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
  status: 'VACANT' | 'RESERVED' | 'OCCUPIED' | 'MAINTENANCE'
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
    if (data.leaseData.depositAmount !== undefined) {
      const deposit = await tx.deposit.findUnique({
        where: { leaseId },
      });
      if (deposit && deposit.status === 'UNPAID') {
        await tx.deposit.update({
          where: { leaseId },
          data: { amount: data.leaseData.depositAmount },
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
      include: { fees: true },
    });

    if (lease.depositAmount.greaterThan(0)) {
      const reservation = await tx.reservation.findUnique({
        where: { roomId: lease.roomId },
      });
      const offset =
        reservation && reservation.deposit.greaterThan(0)
          ? reservation.deposit
          : new Prisma.Decimal(0);
      const netDeposit = new Prisma.Decimal(lease.depositAmount).minus(offset);

      const bill = await tx.bill.create({
        data: {
          organizationId,
          leaseId: lease.id,
          mode: 'DEPOSIT',
          billingDate: startOfLeaseDay(lease.startDate).toDate(),
          periodStart: startOfLeaseDay(lease.startDate).toDate(),
          periodEnd: startOfLeaseDay(lease.endDate).toDate(),
          dueDate: startOfLeaseDay(lease.startDate).toDate(),
          status: netDeposit.lessThanOrEqualTo(0) ? 'PAID' : 'UNPAID',
          totalAmount: netDeposit,
          paidAmount: offset,
          note: offset.greaterThan(0) ? '预留定金已抵扣' : undefined,
          items: {
            create: [
              {
                type: 'DEPOSIT',
                name: offset.greaterThan(0) ? '押金（预留定金已抵扣）' : '押金',
                amount: netDeposit,
                status: netDeposit.lessThanOrEqualTo(0) ? 'PAID' : 'UNPAID',
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
            method: reservation?.paymentMethod || '预留定金抵扣',
            note: '预留定金转押金',
            status: 'COMPLETED',
          },
        });
      }

      await tx.deposit.create({
        data: {
          organizationId,
          leaseId: lease.id,
          billId: bill.id,
          amount: lease.depositAmount,
          paidAmount: offset,
          status: offset.greaterThan(0) ? 'PAID' : 'UNPAID',
        },
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
