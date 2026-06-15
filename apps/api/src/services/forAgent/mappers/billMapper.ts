import type { Prisma } from '@prisma/client';

type BillWithRelations = Prisma.BillGetPayload<{
  include: {
    lease: {
      select: {
        tenantName: true;
        room: { select: { roomNo: true } };
      };
    };
    items: true;
    payments: {
      include: { user: { select: { username: true } } };
    };
  };
}>;

export function toAgentBillSummary(bill: BillWithRelations) {
  return {
    id: bill.id,
    tenantName: bill.lease.tenantName,
    roomNo: bill.lease.room.roomNo,
    billingDate: bill.billingDate.toISOString().split('T')[0],
    periodStart: bill.periodStart.toISOString().split('T')[0],
    periodEnd: bill.periodEnd.toISOString().split('T')[0],
    dueDate: bill.dueDate.toISOString().split('T')[0],
    totalAmount: Number(bill.totalAmount),
    paidAmount: Number(bill.paidAmount),
    remainingAmount: Number(
      (Number(bill.totalAmount) - Number(bill.paidAmount)).toFixed(2)
    ),
    status: bill.status,
    mode: bill.mode,
    note: bill.note,
    failureReason: bill.failureReason,
    items: bill.items.map((item) => ({
      type: item.type,
      name: item.name,
      amount: Number(item.amount),
      status: item.status,
      previousWater: item.previousWater ? Number(item.previousWater) : null,
      currentWater: item.currentWater ? Number(item.currentWater) : null,
      previousPower: item.previousPower ? Number(item.previousPower) : null,
      currentPower: item.currentPower ? Number(item.currentPower) : null,
    })),
    payments: bill.payments.map((p) => ({
      id: p.id,
      type: p.type,
      amount: Number(p.amount),
      method: p.method,
      status: p.status,
      note: p.note,
      recordedBy: p.user.username,
      paidAt: p.paidAt.toISOString().split('T')[0],
    })),
  };
}
