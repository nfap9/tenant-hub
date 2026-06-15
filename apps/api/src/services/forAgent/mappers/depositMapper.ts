import type { Prisma } from '@prisma/client';

type DepositWithRelations = Prisma.DepositGetPayload<{
  include: {
    lease: {
      include: {
        room: { include: { apartment: { select: { name: true } } } };
      };
    };
  };
}>;

export function toAgentDepositSummary(deposit: DepositWithRelations) {
  return {
    id: deposit.id,
    tenantName: deposit.lease.tenantName,
    roomNo: deposit.lease.room.roomNo,
    apartmentName: deposit.lease.room.apartment.name,
    amount: Number(deposit.amount),
    paidAmount: Number(deposit.paidAmount),
    refundedAmount: Number(deposit.refundedAmount),
    deductedAmount: Number(deposit.deductedAmount),
    status: deposit.status,
    createdAt: deposit.createdAt.toISOString().split('T')[0],
  };
}
