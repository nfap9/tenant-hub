import { hasExpired, isAutoRenewalPeriod } from '../../leaseLifecycle.js';
import type { Prisma } from '@prisma/client';

type LeaseWithRelations = Prisma.LeaseGetPayload<{
  include: {
    room: { include: { apartment: { select: { name: true } } } };
    fees: true;
    deposit: true;
  };
}>;

export function toAgentLeaseSummary(lease: LeaseWithRelations) {
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
}
