import type { Bill, BillStatus, Payment } from '@/types/domain';

export type BillGroup = {
  id: string;
  leaseId: string;
  billingDate: string;
  dueDate: string;
  tenantName: string;
  tenantPhone: string;
  status: BillStatus;
  totalAmount: number;
  paidAmount: number;
  lease?: Bill['lease'];
  bills: Bill[];
  payments: Payment[];
};

export const remainingAmount = (bill: {
  totalAmount: string | number;
  paidAmount: string | number;
}) => Number(bill.totalAmount) - Number(bill.paidAmount);

const statusPriority: Record<BillStatus, number> = {
  UNPAID: 0,
  PAID: 1,
  VOID: 2,
};

export const groupBills = (bills: Bill[]): BillGroup[] => {
  const map = new Map<string, Bill[]>();
  for (const bill of bills) {
    const key = `${bill.leaseId}_${bill.billingDate}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(bill);
  }

  return Array.from(map.entries()).map(([key, groupBills]) => {
    const first = groupBills[0];
    const totalAmount = groupBills.reduce(
      (sum, b) => sum + Number(b.totalAmount),
      0
    );
    const paidAmount = groupBills.reduce(
      (sum, b) => sum + Number(b.paidAmount),
      0
    );
    const payments = groupBills.flatMap((b) => b.payments ?? []);

    let status: BillStatus = 'PAID';
    for (const b of groupBills) {
      if (b.status === 'UNPAID') {
        status = b.status;
        break;
      }
    }

    return {
      id: key,
      leaseId: first.leaseId,
      billingDate: first.billingDate,
      dueDate: first.dueDate,
      tenantName: first.lease?.tenantName ?? '',
      tenantPhone: first.lease?.tenantPhone ?? '',
      status,
      totalAmount,
      paidAmount,
      lease: first.lease,
      bills: groupBills,
      payments,
    };
  });
};

export const sortBillGroupsForList = (groups: BillGroup[]) =>
  [...groups].sort((left, right) => {
    const priorityDiff =
      statusPriority[left.status] - statusPriority[right.status];
    if (priorityDiff !== 0) return priorityDiff;
    const dueDateDiff =
      new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
    if (dueDateDiff !== 0) return dueDateDiff;
    return (
      new Date(right.billingDate).getTime() -
      new Date(left.billingDate).getTime()
    );
  });

export const getGroupItems = (group: BillGroup): Bill['items'] =>
  group.bills.flatMap((b) => b.items ?? []);
