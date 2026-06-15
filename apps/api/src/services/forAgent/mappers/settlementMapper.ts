import type { Prisma } from '@prisma/client';

type SettlementWithRelations = Prisma.LeaseSettlementGetPayload<{
  include: {
    lease: {
      select: {
        tenantName: true;
        tenantPhone: true;
        room: {
          select: {
            roomNo: true;
            apartment: { select: { name: true } };
          };
        };
      };
    };
    room: { select: { roomNo: true } };
    payments: {
      include: { user: { select: { username: true } } };
    };
    bill: { select: { totalAmount: true; paidAmount: true; status: true } };
  };
}>;

export function toAgentSettlementSummary(settlement: SettlementWithRelations) {
  return {
    id: settlement.id,
    tenantName: settlement.lease.tenantName,
    roomNo: settlement.lease.room.roomNo,
    apartmentName: settlement.lease.room.apartment.name,
    type: settlement.type,
    reason: settlement.reason,
    terminatedAt: settlement.terminatedAt.toISOString().split('T')[0],
    rentAdjustmentAmount: Number(settlement.rentAdjustmentAmount),
    otherFeeAmount: Number(settlement.otherFeeAmount),
    penaltyAmount: Number(settlement.penaltyAmount),
    compensationAmount: Number(settlement.compensationAmount),
    depositRefundAmount: Number(settlement.depositRefundAmount ?? 0),
    netAmount: Number(settlement.netAmount ?? 0),
    status: settlement.status,
    billAmount: settlement.bill ? Number(settlement.bill.totalAmount) : null,
    billPaidAmount: settlement.bill ? Number(settlement.bill.paidAmount) : null,
    paymentCount: settlement.payments.length,
    totalPaid: settlement.payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    ),
    createdAt: settlement.createdAt.toISOString().split('T')[0],
  };
}
