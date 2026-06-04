import { prisma } from '../../config/prisma.js';
import { hasExpired, isAutoRenewalPeriod } from '../leaseLifecycle.js';

/**
 * 为经纪人查询租约列表（支持筛选和精简字段返回）
 * @param params - 查询参数，包含组织 ID、租客姓名、房间 ID、状态及数量限制
 * @returns 精简后的租约列表（含生命周期状态及押金信息）
 */
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

/**
 * 为经纪人查询退租结算列表（支持按租约筛选和精简字段返回）
 * @param params - 查询参数，包含组织 ID、租约 ID 及数量限制
 * @returns 精简后的退租结算列表（含账单、收款汇总信息）
 */
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
