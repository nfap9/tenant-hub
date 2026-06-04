import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import {
  hasExpired,
  isAutoRenewalPeriod,
  startOfLeaseDay,
  withLeaseLifecycle,
} from './leaseLifecycle.js';

const leaseInclude = {
  room: { include: { apartment: true } },
  fees: true,
  deposit: true,
} as const;

export const listLeases = async (organizationId: string) => {
  const leases = await prisma.lease.findMany({
    where: { organizationId },
    include: leaseInclude,
    orderBy: { createdAt: 'desc' },
  });
  return leases.map((lease) => withLeaseLifecycle(lease));
};

export const getLeaseById = async (leaseId: string, organizationId: string) => {
  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, organizationId },
    include: { fees: true },
  });
  return lease;
};

export const findRoomById = async (roomId: string, organizationId: string) => {
  return prisma.room.findFirst({
    where: { id: roomId, apartment: { organizationId } },
    select: { id: true, status: true },
  });
};

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

export const updateRoomStatus = async (
  roomId: string,
  status: 'VACANT' | 'RESERVED' | 'OCCUPIED' | 'MAINTENANCE'
) => {
  return prisma.room.update({
    where: { id: roomId },
    data: { status },
  });
};

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

export const getLeaseWithFees = async (
  leaseId: string,
  organizationId: string
) => {
  return prisma.lease.findFirst({
    where: { id: leaseId, organizationId },
    include: { fees: true },
  });
};

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

export const queryLeasesForAgent = async ({
  organizationId,
  tenantName,
  roomId,
  status,
  limit = 30,
}: {
  organizationId: string;
  tenantName?: string;
  roomId?: string;
  status?: 'ACTIVE' | 'TERMINATED' | 'EXPIRED' | 'DRAFT';
  limit?: number;
}) => {
  const leases = await prisma.lease.findMany({
    where: {
      organizationId,
      deletedAt: null,
      ...(tenantName
        ? {
            tenantName: { contains: tenantName, mode: 'insensitive' },
          }
        : {}),
      ...(roomId ? { roomId } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      room: { include: { apartment: { select: { name: true } } } },
      fees: true,
      deposit: true,
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  return leases.map((lease) => {
    return {
      id: lease.id,
      tenantName: lease.tenantName,
      tenantPhone: lease.tenantPhone,
      roomNo: lease.room.roomNo,
      apartmentName: lease.room.apartment.name,
      startDate: lease.startDate.toISOString().split('T')[0],
      endDate: lease.endDate.toISOString().split('T')[0],
      rentAmount: Number(lease.rentAmount),
      depositAmount: Number(lease.depositAmount),
      waterUnitPrice: Number(lease.waterUnitPrice),
      powerUnitPrice: Number(lease.powerUnitPrice),
      status: lease.status,
      isExpired: hasExpired(lease),
      isAutoRenewal: isAutoRenewalPeriod(lease),
      cycle: lease.cycle,
      autoRenew: lease.autoRenew,
      fees: lease.fees.map((f) => ({
        type: f.type,
        name: f.name,
        amount: Number(f.amount),
      })),
      deposit: lease.deposit
        ? {
            id: lease.deposit.id,
            amount: Number(lease.deposit.amount),
            paidAmount: Number(lease.deposit.paidAmount),
            refundedAmount: Number(lease.deposit.refundedAmount),
            deductedAmount: Number(lease.deposit.deductedAmount),
            status: lease.deposit.status,
          }
        : null,
    };
  });
};

export const querySettlementsForAgent = async ({
  organizationId,
  leaseId,
  limit = 30,
}: {
  organizationId: string;
  leaseId?: string;
  limit?: number;
}) => {
  const settlements = await prisma.leaseSettlement.findMany({
    where: {
      organizationId,
      ...(leaseId ? { leaseId } : {}),
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
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  return settlements.map((s) => ({
    id: s.id,
    tenantName: s.lease.tenantName,
    roomNo: s.lease.room.roomNo,
    apartmentName: s.lease.room.apartment.name,
    type: s.type,
    reason: s.reason,
    terminatedAt: s.terminatedAt.toISOString().split('T')[0],
    rentAdjustmentAmount: Number(s.rentAdjustmentAmount),
    otherFeeAmount: Number(s.otherFeeAmount),
    penaltyAmount: Number(s.penaltyAmount),
    compensationAmount: Number(s.compensationAmount),
    depositRefundAmount: Number(s.depositRefundAmount ?? 0),
    netAmount: Number(s.netAmount ?? 0),
    status: s.status,
    billAmount: s.bill ? Number(s.bill.totalAmount) : null,
    billPaidAmount: s.bill ? Number(s.bill.paidAmount) : null,
    paymentCount: s.payments.length,
    totalPaid: s.payments.reduce((sum, p) => sum + Number(p.amount), 0),
    createdAt: s.createdAt.toISOString().split('T')[0],
  }));
};
