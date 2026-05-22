import { day, money } from '../../utils/format';
import type { MonthlyBill, BillStatus } from '../../types/domain';

export const remainingAmount = (bill: MonthlyBill) =>
  Number(bill.totalAmount) - Number(bill.paidAmount);

export const roomKeyForBill = (bill: MonthlyBill) =>
  bill.lease?.roomId ??
  bill.lease?.room?.id ??
  bill.lease?.room?.roomNo ??
  bill.id;

const statusPriority: Record<MonthlyBill['status'], number> = {
  UNPAID: 0,
  PARTIAL_PAID: 0,
  BILLING: 1,
  FAILED: 2,
  DRAFT: 2,
  PAID: 3,
  VOID: 4,
};

export const sortMonthlyBillsForList = (bills: MonthlyBill[]) =>
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

export const getMonthlyBillCardSummary = (bill: MonthlyBill) => {
  const billCount = bill.bills?.length ?? 0;
  const paymentCount = bill.payments?.length ?? 0;
  return {
    title: `${bill.tenantName} · ${day(bill.billingDate)}`,
    meta: `${bill.lease?.room?.roomNo ?? '房间'} · 到期 ${day(bill.dueDate)}`,
    totalAmount: Number(bill.totalAmount ?? 0),
    paidAmount: Number(bill.paidAmount ?? 0),
    remainingAmount:
      Number(bill.totalAmount ?? 0) - Number(bill.paidAmount ?? 0),
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
