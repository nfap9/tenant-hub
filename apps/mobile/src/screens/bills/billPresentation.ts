import type { MonthlyBill } from '../../types';

const day = (value: string) => value.slice(0, 10);
const amount = (value?: string | number) => Number(value ?? 0);
const statusPriority: Record<MonthlyBill['status'], number> = {
  UNPAID: 0,
  PARTIAL_PAID: 0,
  BILLING: 1,
  FAILED: 2,
  DRAFT: 2,
  PAID: 3,
  VOID: 4,
};

export const getMonthlyBillCardSummary = (bill: MonthlyBill) => {
  const billCount = bill.bills?.length ?? 0;
  const paymentCount = bill.payments?.length ?? 0;

  return {
    title: `${bill.tenantName} · ${day(bill.billingDate)}`,
    meta: `${bill.lease?.room?.roomNo ?? '房间'} · 到期 ${day(bill.dueDate)}`,
    totalAmount: amount(bill.totalAmount),
    paidAmount: amount(bill.paidAmount),
    remainingAmount: amount(bill.totalAmount) - amount(bill.paidAmount),
    detailCountText: `${billCount} 项账单 · ${paymentCount} 笔收款`,
  };
};

export const sortMonthlyBillsForList = (bills: MonthlyBill[]) =>
  [...bills].sort((left, right) => {
    const priorityDiff = statusPriority[left.status] - statusPriority[right.status];
    if (priorityDiff !== 0) return priorityDiff;

    const dueDateDiff = new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
    if (dueDateDiff !== 0) return dueDateDiff;

    return new Date(right.billingDate).getTime() - new Date(left.billingDate).getTime();
  });
