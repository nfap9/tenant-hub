import dayjs from "dayjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";

const cycleMonths = {
  MONTHLY: 1,
  QUARTERLY: 3,
  YEARLY: 12
} as const;

export const generateLeaseBills = async (leaseId: string) => {
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: { fees: true, bills: true }
  });
  if (!lease) return;

  const existingStarts = new Set(lease.bills.map((bill) => bill.periodStart.toISOString()));
  const months = cycleMonths[lease.cycle];
  const bills: string[] = [];
  let cursor = dayjs(lease.startDate);
  const leaseEnd = dayjs(lease.endDate);

  while (cursor.isBefore(leaseEnd) || cursor.isSame(leaseEnd, "day")) {
    const periodStart = cursor.startOf("day");
    const periodEnd = cursor.add(months, "month").subtract(1, "day").isAfter(leaseEnd)
      ? leaseEnd
      : cursor.add(months, "month").subtract(1, "day");
    const dueDate = periodStart.add(lease.graceDays, "day");

    if (!existingStarts.has(periodStart.toDate().toISOString())) {
      const otherTotal = lease.fees.reduce((sum, fee) => sum.plus(fee.amount), new Prisma.Decimal(0));
      const totalAmount = new Prisma.Decimal(lease.rentAmount).plus(otherTotal);

      const bill = await prisma.bill.create({
        data: {
          organizationId: lease.organizationId,
          leaseId: lease.id,
          periodStart: periodStart.toDate(),
          periodEnd: periodEnd.toDate(),
          dueDate: dueDate.toDate(),
          status: "BILLING",
          totalAmount,
          items: {
            create: [
              { type: "RENT", name: "房租", amount: lease.rentAmount, status: "UNPAID" },
              {
                type: "UTILITY",
                name: "水电费",
                amount: 0,
                status: "BILLING",
                waterUnitPrice: lease.waterUnitPrice,
                powerUnitPrice: lease.powerUnitPrice
              },
              ...lease.fees.map((fee) => ({
                type: "OTHER" as const,
                name: fee.name,
                amount: fee.amount,
                status: "UNPAID" as const
              }))
            ]
          }
        }
      });
      bills.push(bill.id);
    }

    cursor = cursor.add(months, "month");
  }

  return bills;
};

export const refreshBillTotals = async (billId: string) => {
  const bill = await prisma.bill.findUnique({ where: { id: billId }, include: { items: true, payments: true } });
  if (!bill) return;

  const totalAmount = bill.items.reduce((sum, item) => sum.plus(item.amount), new Prisma.Decimal(0));
  const paidAmount = bill.payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
  const status = paidAmount.greaterThanOrEqualTo(totalAmount)
    ? "PAID"
    : paidAmount.greaterThan(0)
      ? "PARTIAL_PAID"
      : bill.items.some((item) => item.status === "BILLING")
        ? "BILLING"
        : "UNPAID";

  await prisma.bill.update({ where: { id: billId }, data: { totalAmount, paidAmount, status } });
};
