import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { startOfLeaseDay, withLeaseLifecycle } from './leaseLifecycle.js';

const leaseInclude = {
  room: { include: { apartment: true } },
  fees: true,
  deposits: true,
} as const;

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
 * 为指定类型的押金生成押金账单及 Deposit 记录
 * @param tx - Prisma 事务客户端
 * @param data - 押金账单创建数据
 * @returns 创建的押金记录
 */
async function createDepositBillAndRecord(
  tx: Prisma.TransactionClient,
  data: {
    lease: {
      id: string;
      startDate: Date;
      endDate: Date;
    };
    organizationId: string;
    depositType: 'ROOM' | 'KEY';
    amount: Prisma.Decimal;
  }
) {
  const { lease, organizationId, depositType, amount } = data;

  if (amount.lessThanOrEqualTo(0)) return null;

  const typeLabel = depositType === 'ROOM' ? '房间押金' : '钥匙押金';
  const periodStart = startOfLeaseDay(lease.startDate).toDate();
  const periodEnd = startOfLeaseDay(lease.endDate).toDate();

  const bill = await tx.bill.create({
    data: {
      organizationId,
      leaseId: lease.id,
      category: 'DEPOSIT',
      billingDate: periodStart,
      dueDate: periodStart,
      status: 'UNPAID',
      totalAmount: amount,
      paidAmount: 0,
      items: {
        create: [
          {
            category: 'DEPOSIT',
            name: typeLabel,
            amount,
            periodStart,
            periodEnd,
          },
        ],
      },
    },
  });

  return tx.deposit.create({
    data: {
      organizationId,
      leaseId: lease.id,
      billId: bill.id,
      type: depositType,
      amount,
      status: 'UNPAID',
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
 * 查询租约原始数据（供复用）
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
 * 创建租约并生成押金账单（含房间押金、钥匙押金）
 * @param data - 租约创建数据
 * @returns 创建完成的租约详情（含房间、费用、押金信息）
 */
export const createLeaseWithDeposit = async (data: {
  leaseData: {
    tenantName?: string;
    tenantPhone?: string;
    startDate: Date;
    endDate: Date;
    rentCycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    rentAmount: Prisma.Decimal.Value;
    depositAmount: Prisma.Decimal.Value;
    keyDepositAmount: Prisma.Decimal.Value;
    waterUnitPrice: Prisma.Decimal.Value;
    powerUnitPrice: Prisma.Decimal.Value;
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
  const { leaseData, roomId, organizationId, fees } = data;
  return prisma.$transaction(async (tx) => {
    const created = await tx.lease.create({
      data: {
        ...leaseData,
        organizationId,
        roomId,
        fees: {
          create: fees.map((fee) => ({ ...fee, period: '月' })),
        },
      },
      include: { room: { include: { apartment: true } }, fees: true },
    });

    if (leaseData.status === 'ACTIVE') {
      const roomDepositAmount = new Prisma.Decimal(
        leaseData.depositAmount
      ).minus(new Prisma.Decimal(leaseData.keyDepositAmount));
      const keyDepositAmount = new Prisma.Decimal(leaseData.keyDepositAmount);

      await createDepositBillAndRecord(tx, {
        lease: created,
        organizationId,
        depositType: 'ROOM',
        amount: roomDepositAmount,
      });

      await createDepositBillAndRecord(tx, {
        lease: created,
        organizationId,
        depositType: 'KEY',
        amount: keyDepositAmount,
      });
    }

    return tx.lease.findUniqueOrThrow({
      where: { id: created.id },
      include: leaseInclude,
    });
  });
};

/**
 * 创建租约但不生成押金账单
 * @param data - 租约创建数据
 * @returns 创建完成的租约详情（含房间、费用、押金信息）
 */
export const createLeaseWithoutDeposit = async (data: {
  leaseData: {
    tenantName?: string;
    tenantPhone?: string;
    startDate: Date;
    endDate: Date;
    rentCycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    rentAmount: Prisma.Decimal.Value;
    depositAmount: Prisma.Decimal.Value;
    keyDepositAmount: Prisma.Decimal.Value;
    waterUnitPrice: Prisma.Decimal.Value;
    powerUnitPrice: Prisma.Decimal.Value;
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
      fees: {
        create: data.fees.map((fee) => ({ ...fee, period: '月' })),
      },
    },
    include: leaseInclude,
  });
};

/**
 * 更新房间状态
 * @param roomId - 房间 ID
 * @param status - 新状态
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
        data: data.fees.map((fee) => ({ ...fee, leaseId, period: '月' })),
      });
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
  const { leaseId, organizationId } = data;

  return prisma.$transaction(async (tx) => {
    const lease = await tx.lease.findUniqueOrThrow({
      where: { id: leaseId },
      include: { fees: true, room: { include: { apartment: true } } },
    });

    const roomDepositAmount = new Prisma.Decimal(lease.depositAmount).minus(
      new Prisma.Decimal(lease.keyDepositAmount)
    );
    const keyDepositAmount = new Prisma.Decimal(lease.keyDepositAmount);

    if (roomDepositAmount.greaterThan(0) || keyDepositAmount.greaterThan(0)) {
      await createDepositBillAndRecord(tx, {
        lease,
        organizationId,
        depositType: 'ROOM',
        amount: roomDepositAmount,
      });

      await createDepositBillAndRecord(tx, {
        lease,
        organizationId,
        depositType: 'KEY',
        amount: keyDepositAmount,
      });
    }

    return tx.lease.update({
      where: { id: lease.id },
      data: { status: 'ACTIVE' },
      include: leaseInclude,
    });
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
 * 获取租约详情（含房间、费用、押金、账单）
 * @param leaseId - 租约 ID
 * @param organizationId - 组织 ID
 * @returns 租约详情
 */
export const getLeaseDetail = async (
  leaseId: string,
  organizationId: string
) => {
  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, organizationId },
    include: {
      room: { include: { apartment: true } },
      fees: true,
      deposits: true,
      bills: {
        include: { items: true },
        orderBy: { billingDate: 'desc' },
      },
    },
  });
  return lease ? withLeaseLifecycle(lease) : null;
};
