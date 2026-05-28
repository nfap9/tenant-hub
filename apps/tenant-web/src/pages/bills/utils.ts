import { day, money } from '@/utils/format';
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

export const roomKeyForBill = (bill: Bill) =>
  bill.lease?.roomId ??
  bill.lease?.room?.id ??
  bill.lease?.room?.roomNo ??
  bill.id;

const statusPriority: Record<BillStatus, number> = {
  UNPAID: 0,
  PARTIAL_PAID: 0,
  BILLING: 1,
  FAILED: 2,
  DRAFT: 2,
  PAID: 3,
  VOID: 4,
  REFUNDED: 5,
};

export const sortBillsForList = (bills: Bill[]) =>
  [...bills].sort((left, right) => {
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
      if (b.status === 'UNPAID' || b.status === 'PARTIAL_PAID') {
        status = b.status;
        break;
      }
      if (b.status === 'BILLING' || b.status === 'FAILED') {
        status = b.status;
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

export const getBillGroupCardSummary = (group: BillGroup) => {
  const billCount = group.bills.length;
  const paymentCount = group.payments.length;
  const type = group.bills[0]?.type;
  return {
    title: `${group.tenantName} · ${day(group.billingDate)}`,
    meta: `${group.lease?.room?.roomNo ?? '房间'} · 到期 ${day(group.dueDate)}`,
    type,
    totalAmount: group.totalAmount,
    paidAmount: group.paidAmount,
    remainingAmount: group.totalAmount - group.paidAmount,
    detailCountText: `${billCount} 项账单 · ${paymentCount} 笔收款`,
  };
};

export const getPaymentAmountError = (
  amountText: string,
  remaining: number
) => {
  if (!amountText.trim()) return '请填写收款金额';
  const amount = Number(amountText);
  if (!Number.isFinite(amount)) return '收款金额必须是有效数字';
  if (amount <= 0) return '收款金额必须大于 0';
  if (amount > remaining)
    return `收款金额不能超过剩余应收 ¥${money(remaining)}`;
  return undefined;
};
