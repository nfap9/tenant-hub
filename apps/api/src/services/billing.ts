import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { cycleMonths, getLeaseBillGenerationEnd, type LeaseCycle } from "./leaseLifecycle.js";
import { HttpError } from "../utils/http.js";

dayjs.extend(utc);

type BillingPeriodInput = {
  leaseStartDate: Date;
  leaseEndDate: Date;
  cycle: LeaseCycle;
  billingDate: Date;
};

type BillingDatesInput = Omit<BillingPeriodInput, "billingDate"> & {
  today?: Date;
};

type UtilityAmountInput = {
  previousWater: Prisma.Decimal.Value;
  currentWater: Prisma.Decimal.Value;
  waterUnitPrice: Prisma.Decimal.Value;
  previousPower: Prisma.Decimal.Value;
  currentPower: Prisma.Decimal.Value;
  powerUnitPrice: Prisma.Decimal.Value;
};

const startOfDay = (date: Date) => dayjs.utc(date).startOf("day");

export const calculateBillingPeriods = ({ leaseStartDate, leaseEndDate, cycle, billingDate }: BillingPeriodInput) => {
  const months = cycleMonths[cycle];
  const billingDay = startOfDay(billingDate);
  const leaseEnd = startOfDay(leaseEndDate);
  const prepaidEnd = billingDay.add(months, "month").subtract(1, "day");
  const postpaidStart = billingDay.subtract(months, "month");

  return {
    prepaid: {
      start: billingDay.toDate(),
      end: (prepaidEnd.isAfter(leaseEnd, "day") ? leaseEnd : prepaidEnd).toDate()
    },
    postpaid: {
      start: (postpaidStart.isBefore(startOfDay(leaseStartDate), "day") ? startOfDay(leaseStartDate) : postpaidStart).toDate(),
      end: billingDay.subtract(1, "day").toDate()
    }
  };
};

export const shouldGeneratePostpaidBill = ({ leaseStartDate, billingDate }: Pick<BillingPeriodInput, "leaseStartDate" | "billingDate">) =>
  startOfDay(billingDate).isAfter(startOfDay(leaseStartDate), "day");

export const getBillingDatesThrough = ({ leaseStartDate, leaseEndDate, cycle, today = new Date() }: BillingDatesInput) => {
  const months = cycleMonths[cycle];
  const dates: Date[] = [];
  const end = startOfDay(today).isBefore(startOfDay(leaseEndDate), "day") ? startOfDay(today) : startOfDay(leaseEndDate);
  let cursor = startOfDay(leaseStartDate);

  while (cursor.isBefore(end, "day") || cursor.isSame(end, "day")) {
    dates.push(cursor.toDate());
    cursor = cursor.add(months, "month");
  }

  return dates;
};

export const calculateUtilityAmount = ({
  previousWater,
  currentWater,
  waterUnitPrice,
  previousPower,
  currentPower,
  powerUnitPrice
}: UtilityAmountInput) => {
  const waterUsage = new Prisma.Decimal(currentWater).minus(previousWater);
  if (waterUsage.lessThan(0)) throw new Error("水表本期读数不能小于上期读数");

  const powerUsage = new Prisma.Decimal(currentPower).minus(previousPower);
  if (powerUsage.lessThan(0)) throw new Error("电表本期读数不能小于上期读数");

  return waterUsage.mul(waterUnitPrice).plus(powerUsage.mul(powerUnitPrice));
};

const classifyFeeItemType = (name: string) => {
  if (name.includes("网")) return "NETWORK" as const;
  if (name.includes("物业") || name.includes("管理")) return "MANAGEMENT" as const;
  return "OTHER" as const;
};

const refreshMonthlyBillTotals = async (monthlyBillId: string) => {
  const monthlyBill = await prisma.monthlyBill.findUnique({
    where: { id: monthlyBillId },
    include: { bills: true, payments: true }
  });
  if (!monthlyBill) return;

  const totalAmount = monthlyBill.bills.reduce((sum, bill) => sum.plus(bill.totalAmount), new Prisma.Decimal(0));
  const paidAmount = monthlyBill.payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
  const status = paidAmount.greaterThanOrEqualTo(totalAmount)
    ? "PAID"
    : paidAmount.greaterThan(0)
      ? "PARTIAL_PAID"
      : "UNPAID";

  await prisma.monthlyBill.update({ where: { id: monthlyBillId }, data: { totalAmount, paidAmount, status } });
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
      : bill.items.some((item) => item.status === "FAILED")
        ? "FAILED"
        : bill.items.some((item) => item.status === "BILLING")
          ? "BILLING"
          : "UNPAID";

  const updated = await prisma.bill.update({ where: { id: billId }, data: { totalAmount, paidAmount, status } });
  if (updated.monthlyBillId) await refreshMonthlyBillTotals(updated.monthlyBillId);
};

const findReadingAtOrBefore = async ({
  organizationId,
  roomId,
  meterType,
  date
}: {
  organizationId: string;
  roomId: string;
  meterType: "WATER" | "POWER";
  date: Date;
}) =>
  prisma.meterReading.findFirst({
    where: {
      organizationId,
      roomId,
      meterType,
      readingDate: { lte: startOfDay(date).endOf("day").toDate() },
      status: { not: "VOID" }
    },
    orderBy: { readingDate: "desc" }
  });

const failPostpaidBill = async (billId: string, failureReason: string) => {
  await prisma.bill.update({
    where: { id: billId },
    data: {
      status: "FAILED",
      failureReason,
      items: { updateMany: { where: {}, data: { status: "FAILED", amount: 0 } } }
    }
  });
};

export const completePostpaidBillFromReadings = async (billId: string) => {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: { lease: { include: { room: true } }, items: true }
  });
  if (!bill || bill.mode !== "POSTPAID") return bill;

  const [previousWater, currentWater, previousPower, currentPower] = await Promise.all([
    findReadingAtOrBefore({ organizationId: bill.organizationId, roomId: bill.lease.roomId, meterType: "WATER", date: bill.periodStart }),
    findReadingAtOrBefore({ organizationId: bill.organizationId, roomId: bill.lease.roomId, meterType: "WATER", date: bill.periodEnd }),
    findReadingAtOrBefore({ organizationId: bill.organizationId, roomId: bill.lease.roomId, meterType: "POWER", date: bill.periodStart }),
    findReadingAtOrBefore({ organizationId: bill.organizationId, roomId: bill.lease.roomId, meterType: "POWER", date: bill.periodEnd })
  ]);

  if (!previousWater || !currentWater || !previousPower || !currentPower) {
    await failPostpaidBill(bill.id, "缺少本期水电起止读数");
    return prisma.bill.findUnique({ where: { id: bill.id }, include: { items: true } });
  }
  if (previousWater.id === currentWater.id || previousPower.id === currentPower.id) {
    await failPostpaidBill(bill.id, "缺少本期水电期末读数");
    return prisma.bill.findUnique({ where: { id: bill.id }, include: { items: true } });
  }

  try {
    calculateUtilityAmount({
      previousWater: previousWater.value,
      currentWater: currentWater.value,
      waterUnitPrice: bill.lease.waterUnitPrice,
      previousPower: previousPower.value,
      currentPower: currentPower.value,
      powerUnitPrice: bill.lease.powerUnitPrice
    });
  } catch (error) {
    await failPostpaidBill(bill.id, error instanceof Error ? error.message : "水电出账失败");
    return prisma.bill.findUnique({ where: { id: bill.id }, include: { items: true } });
  }

  const waterAmount = new Prisma.Decimal(currentWater.value).minus(previousWater.value).mul(bill.lease.waterUnitPrice);
  const powerAmount = new Prisma.Decimal(currentPower.value).minus(previousPower.value).mul(bill.lease.powerUnitPrice);

  await prisma.$transaction([
    prisma.billItem.updateMany({
      where: { billId: bill.id, type: "WATER" },
      data: {
        amount: waterAmount,
        status: "UNPAID",
        previousWater: previousWater.value,
        currentWater: currentWater.value,
        waterUnitPrice: bill.lease.waterUnitPrice
      }
    }),
    prisma.billItem.updateMany({
      where: { billId: bill.id, type: "POWER" },
      data: {
        amount: powerAmount,
        status: "UNPAID",
        previousPower: previousPower.value,
        currentPower: currentPower.value,
        powerUnitPrice: bill.lease.powerUnitPrice
      }
    }),
    prisma.bill.update({ where: { id: bill.id }, data: { status: "UNPAID", failureReason: null } })
  ]);
  await refreshBillTotals(bill.id);

  return prisma.bill.findUnique({ where: { id: bill.id }, include: { items: true } });
};

const tryCreateMonthlyBill = async (leaseId: string, billingDate: Date) => {
  const lease = await prisma.lease.findUnique({ where: { id: leaseId }, include: { bills: true } });
  if (!lease) return null;

  const children = await prisma.bill.findMany({
    where: { leaseId, billingDate: startOfDay(billingDate).toDate() },
    include: { items: true }
  });
  const hasBlockedBill = children.some((bill) => bill.status === "BILLING" || bill.status === "FAILED");
  if (!children.length || hasBlockedBill) return null;

  const totalAmount = children.reduce((sum, bill) => sum.plus(bill.totalAmount), new Prisma.Decimal(0));
  const monthlyBill = await prisma.monthlyBill.upsert({
    where: { leaseId_billingDate: { leaseId, billingDate: startOfDay(billingDate).toDate() } },
    create: {
      organizationId: lease.organizationId,
      leaseId,
      tenantName: lease.tenantName,
      tenantPhone: lease.tenantPhone,
      billingDate: startOfDay(billingDate).toDate(),
      dueDate: startOfDay(billingDate).add(lease.graceDays, "day").toDate(),
      totalAmount,
      status: "UNPAID"
    },
    update: { totalAmount }
  });

  await prisma.bill.updateMany({
    where: { leaseId, billingDate: startOfDay(billingDate).toDate(), monthlyBillId: null },
    data: { monthlyBillId: monthlyBill.id }
  });

  await refreshMonthlyBillTotals(monthlyBill.id);
  return prisma.monthlyBill.findUnique({ where: { id: monthlyBill.id }, include: { bills: { include: { items: true } }, payments: true } });
};

export const generateLeaseBills = async (leaseId: string, today = new Date()) => {
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: { fees: true, bills: true, room: { include: { apartment: true } } }
  });
  if (!lease) return;

  const billingEnd = getLeaseBillGenerationEnd(lease, today);
  const billingDates = getBillingDatesThrough({
    leaseStartDate: lease.startDate,
    leaseEndDate: billingEnd,
    cycle: lease.cycle,
    today
  });
  const generatedIds: string[] = [];

  for (const billingDate of billingDates) {
    const periods = calculateBillingPeriods({
      leaseStartDate: lease.startDate,
      leaseEndDate: billingEnd,
      cycle: lease.cycle,
      billingDate
    });
    const dueDate = startOfDay(billingDate).add(lease.graceDays, "day").toDate();
    const isFirstBill = startOfDay(billingDate).isSame(startOfDay(lease.startDate), "day");

    const prepaid = await prisma.bill.upsert({
      where: { leaseId_billingDate_mode: { leaseId: lease.id, billingDate: startOfDay(billingDate).toDate(), mode: "PREPAID" } },
      create: {
        organizationId: lease.organizationId,
        leaseId: lease.id,
        mode: "PREPAID",
        billingDate: startOfDay(billingDate).toDate(),
        periodStart: periods.prepaid.start,
        periodEnd: periods.prepaid.end,
        dueDate,
        status: "UNPAID",
        items: {
          create: [
            { type: "RENT", name: "房租", amount: lease.rentAmount, status: "UNPAID" },
            ...lease.fees.map((fee) => ({
              type: classifyFeeItemType(fee.name),
              name: fee.name,
              amount: fee.amount,
              status: "UNPAID" as const
            })),
            ...(isFirstBill && new Prisma.Decimal(lease.depositAmount).greaterThan(0)
              ? [{ type: "DEPOSIT" as const, name: "押金", amount: lease.depositAmount, status: "UNPAID" as const }]
              : [])
          ]
        }
      },
      update: {}
    });
    await refreshBillTotals(prepaid.id);
    generatedIds.push(prepaid.id);

    if (shouldGeneratePostpaidBill({ leaseStartDate: lease.startDate, billingDate })) {
      const postpaid = await prisma.bill.upsert({
        where: { leaseId_billingDate_mode: { leaseId: lease.id, billingDate: startOfDay(billingDate).toDate(), mode: "POSTPAID" } },
        create: {
          organizationId: lease.organizationId,
          leaseId: lease.id,
          mode: "POSTPAID",
          billingDate: startOfDay(billingDate).toDate(),
          periodStart: periods.postpaid.start,
          periodEnd: periods.postpaid.end,
          dueDate,
          status: "BILLING",
          items: {
            create: [
              { type: "WATER", name: "水费", amount: 0, status: "BILLING", waterUnitPrice: lease.waterUnitPrice },
              { type: "POWER", name: "电费", amount: 0, status: "BILLING", powerUnitPrice: lease.powerUnitPrice }
            ]
          }
        },
        update: {}
      });
      generatedIds.push(postpaid.id);
      if (postpaid.status === "BILLING" || postpaid.status === "FAILED") {
        await completePostpaidBillFromReadings(postpaid.id);
      }
    }

    await tryCreateMonthlyBill(lease.id, billingDate);
  }

  return generatedIds;
};

export const generateActiveAutoRenewBills = async (organizationId: string) => {
  const leases = await prisma.lease.findMany({
    where: { organizationId, status: "ACTIVE" },
    select: { id: true }
  });

  await Promise.all(leases.map((lease) => generateLeaseBills(lease.id)));
};

export const retryPostpaidBillAndMonthlyBill = async (billId: string) => {
  const bill = await completePostpaidBillFromReadings(billId);
  if (!bill) return null;
  await tryCreateMonthlyBill(bill.leaseId, bill.billingDate);
  return prisma.bill.findUnique({ where: { id: bill.id }, include: { items: true, monthlyBill: true } });
};

export const recordMonthlyBillPayment = async ({
  monthlyBillId,
  userId,
  amount,
  method,
  note
}: {
  monthlyBillId: string;
  userId: string;
  amount: Prisma.Decimal.Value;
  method: string;
  note?: string;
}) => {
  const current = await prisma.monthlyBill.findUnique({ where: { id: monthlyBillId } });
  if (!current) throw new HttpError(404, "月度账单不存在");
  if (current.status === "PAID" || current.status === "VOID") throw new HttpError(400, "该账单已结清或作废，不能继续收款");
  const paymentAmount = new Prisma.Decimal(amount);
  const remaining = new Prisma.Decimal(current.totalAmount).minus(current.paidAmount);
  if (paymentAmount.greaterThan(remaining)) throw new HttpError(400, `收款金额不能超过剩余应收 ¥${remaining.toFixed(2)}`);

  const payment = await prisma.payment.create({ data: { monthlyBillId, userId, amount, method, note } });
  await refreshMonthlyBillTotals(monthlyBillId);
  const monthlyBill = await prisma.monthlyBill.findUnique({ where: { id: monthlyBillId }, include: { bills: true } });
  if (monthlyBill?.status === "PAID") {
    await prisma.$transaction(
      monthlyBill.bills.map((bill) => prisma.bill.update({ where: { id: bill.id }, data: { status: "PAID", paidAmount: bill.totalAmount } }))
    );
  }
  return payment;
};
