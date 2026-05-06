import type { MonthlyBill } from "../../types";

const day = (value: string) => value.slice(0, 10);
const amount = (value?: string | number) => Number(value ?? 0);

export const getMonthlyBillCardSummary = (bill: MonthlyBill) => {
  const billCount = bill.bills?.length ?? 0;
  const paymentCount = bill.payments?.length ?? 0;

  return {
    title: `${bill.tenantName} · ${day(bill.billingDate)}`,
    meta: `${bill.lease?.room?.roomNo ?? "房间"} · 到期 ${day(bill.dueDate)}`,
    totalAmount: amount(bill.totalAmount),
    paidAmount: amount(bill.paidAmount),
    remainingAmount: amount(bill.totalAmount) - amount(bill.paidAmount),
    detailCountText: `${billCount} 项账单 · ${paymentCount} 笔收款`
  };
};
