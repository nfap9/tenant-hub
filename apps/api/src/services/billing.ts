import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import {
  cycleMonths,
  getLeaseBillGenerationEnd,
  type LeaseCycle,
} from './leaseLifecycle.js';
import { HttpError } from '../utils/http.js';

dayjs.extend(utc);

type BillingPeriodInput = {
  leaseStartDate: Date;
  leaseEndDate: Date;
  cycle: LeaseCycle;
  billingDate: Date;
};

type BillingDatesInput = Omit<BillingPeriodInput, 'billingDate'> & {
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

type PaymentTarget = {
  status: string;
  totalAmount: Prisma.Decimal.Value;
  paidAmount: Prisma.Decimal.Value;
};

type BillPaymentTarget = PaymentTarget & {
  amount: Prisma.Decimal.Value;
};

type MonthlyBillPaymentTarget = BillPaymentTarget & {
  childBillPaymentsCount: number;
};

const startOfDay = (date: Date) => dayjs.utc(date).startOf('day');

export const calculateBillingPeriods = ({
  leaseStartDate,
  leaseEndDate,
  cycle,
  billingDate,
}: BillingPeriodInput) => {
  const months = cycleMonths[cycle];
  const billingDay = startOfDay(billingDate);
  const leaseEnd = startOfDay(leaseEndDate);
  const prepaidEnd = billingDay.add(months, 'month').subtract(1, 'day');
  const postpaidStart = billingDay.subtract(months, 'month');

  return {
    prepaid: {
      start: billingDay.toDate(),
      end: (prepaidEnd.isAfter(leaseEnd, 'day')
        ? leaseEnd
        : prepaidEnd
      ).toDate(),
    },
    postpaid: {
      start: (postpaidStart.isBefore(startOfDay(leaseStartDate), 'day')
        ? startOfDay(leaseStartDate)
        : postpaidStart
      ).toDate(),
      end: billingDay.subtract(1, 'day').toDate(),
    },
  };
};

export const shouldGeneratePostpaidBill = ({
  leaseStartDate,
  billingDate,
}: Pick<BillingPeriodInput, 'leaseStartDate' | 'billingDate'>) =>
  startOfDay(billingDate).isAfter(startOfDay(leaseStartDate), 'day');

export const getBillingDatesThrough = ({
  leaseStartDate,
  leaseEndDate,
  cycle,
  today = new Date(),
}: BillingDatesInput) => {
  const months = cycleMonths[cycle];
  const dates: Date[] = [];
  const end = startOfDay(today).isBefore(startOfDay(leaseEndDate), 'day')
    ? startOfDay(today)
    : startOfDay(leaseEndDate);
  let cursor = startOfDay(leaseStartDate);

  while (cursor.isBefore(end, 'day') || cursor.isSame(end, 'day')) {
    dates.push(cursor.toDate());
    cursor = cursor.add(months, 'month');
  }

  return dates;
};

export const getCurrentMonthBillWindow = (today = new Date()) => ({
  start: startOfDay(today).startOf('month').toDate(),
  end: startOfDay(today).add(1, 'month').startOf('month').toDate(),
});

export const getBillMonthLabel = (billingDate: Date) => {
  const date = startOfDay(billingDate);
  return `${date.year()}年${date.month() + 1}月`;
};

export const calculateUtilityAmount = ({
  previousWater,
  currentWater,
  waterUnitPrice,
  previousPower,
  currentPower,
  powerUnitPrice,
}: UtilityAmountInput) => {
  const waterUsage = new Prisma.Decimal(currentWater).minus(previousWater);
  if (waterUsage.lessThan(0)) throw new Error('水表本期读数不能小于上期读数');

  const powerUsage = new Prisma.Decimal(currentPower).minus(previousPower);
  if (powerUsage.lessThan(0)) throw new Error('电表本期读数不能小于上期读数');

  return waterUsage.mul(waterUnitPrice).plus(powerUsage.mul(powerUnitPrice));
};

export const calculateUtilityLineAmounts = ({
  previousWater,
  currentWater,
  waterUnitPrice,
  previousPower,
  currentPower,
  powerUnitPrice,
}: UtilityAmountInput) => {
  calculateUtilityAmount({
    previousWater,
    currentWater,
    waterUnitPrice,
    previousPower,
    currentPower,
    powerUnitPrice,
  });
  return {
    waterAmount: new Prisma.Decimal(currentWater)
      .minus(previousWater)
      .mul(waterUnitPrice),
    powerAmount: new Prisma.Decimal(currentPower)
      .minus(previousPower)
      .mul(powerUnitPrice),
  };
};

const remainingAmountFor = ({ totalAmount, paidAmount }: PaymentTarget) =>
  new Prisma.Decimal(totalAmount).minus(paidAmount);

export const assertBillPaymentAllowed = ({
  status,
  totalAmount,
  paidAmount,
  amount,
}: BillPaymentTarget) => {
  if (status === 'PAID' || status === 'VOID')
    throw new HttpError(400, '该账单已结清或作废，不能继续收款');
  const paymentAmount = new Prisma.Decimal(amount);
  if (paymentAmount.lessThanOrEqualTo(0))
    throw new HttpError(400, '收款金额必须大于 0');
  const remaining = remainingAmountFor({ status, totalAmount, paidAmount });
  if (paymentAmount.greaterThan(remaining))
    throw new HttpError(
      400,
      `收款金额不能超过剩余应收 ¥${remaining.toFixed(2)}`
    );
};

export const assertMonthlyBillPaymentAllowed = ({
  status,
  totalAmount,
  paidAmount,
  childBillPaymentsCount,
  amount,
}: MonthlyBillPaymentTarget) => {
  if (childBillPaymentsCount > 0)
    throw new HttpError(
      400,
      '子账单已有独立收款，请继续按子账单收款或先冲销原收款'
    );
  assertBillPaymentAllowed({ status, totalAmount, paidAmount, amount });
};

const classifyFeeItemType = (name: string) => {
  if (name.includes('网')) return 'NETWORK' as const;
  if (name.includes('物业') || name.includes('管理'))
    return 'MANAGEMENT' as const;
  return 'OTHER' as const;
};

export const refreshMonthlyBillTotals = async (monthlyBillId: string) => {
  const monthlyBill = await prisma.monthlyBill.findUnique({
    where: { id: monthlyBillId },
    include: { bills: true, payments: true },
  });
  if (!monthlyBill) return;

  const totalAmount = monthlyBill.bills.reduce(
    (sum, bill) => sum.plus(bill.totalAmount),
    new Prisma.Decimal(0)
  );
  const paidAmount = monthlyBill.payments.reduce(
    (sum, payment) => sum.plus(payment.amount),
    new Prisma.Decimal(0)
  );
  const status = paidAmount.greaterThanOrEqualTo(totalAmount)
    ? 'PAID'
    : paidAmount.greaterThan(0)
      ? 'PARTIAL_PAID'
      : 'UNPAID';

  await prisma.monthlyBill.update({
    where: { id: monthlyBillId },
    data: { totalAmount, paidAmount, status },
  });
};

export const refreshBillTotals = async (billId: string) => {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: { items: true, payments: true },
  });
  if (!bill) return;

  const totalAmount = bill.items.reduce(
    (sum, item) => sum.plus(item.amount),
    new Prisma.Decimal(0)
  );
  const paidAmount = bill.payments.reduce(
    (sum, payment) => sum.plus(payment.amount),
    new Prisma.Decimal(0)
  );
  const status = paidAmount.greaterThanOrEqualTo(totalAmount)
    ? 'PAID'
    : paidAmount.greaterThan(0)
      ? 'PARTIAL_PAID'
      : bill.items.some((item) => item.status === 'FAILED')
        ? 'FAILED'
        : bill.items.some((item) => item.status === 'BILLING')
          ? 'BILLING'
          : 'UNPAID';

  const updated = await prisma.bill.update({
    where: { id: billId },
    data: { totalAmount, paidAmount, status },
  });
  if (updated.monthlyBillId)
    await refreshMonthlyBillTotals(updated.monthlyBillId);
};

const findReadingAtOrBefore = async ({
  organizationId,
  roomId,
  meterType,
  date,
}: {
  organizationId: string;
  roomId: string;
  meterType: 'WATER' | 'POWER';
  date: Date;
}) =>
  prisma.meterReading.findFirst({
    where: {
      organizationId,
      roomId,
      meterType,
      readingDate: { lte: startOfDay(date).endOf('day').toDate() },
      status: { not: 'VOID' },
    },
    orderBy: { readingDate: 'desc' },
  });

const failPostpaidBill = async (billId: string, failureReason: string) => {
  await prisma.bill.update({
    where: { id: billId },
    data: {
      status: 'FAILED',
      failureReason,
      items: {
        updateMany: { where: {}, data: { status: 'FAILED', amount: 0 } },
      },
    },
  });
};

export const completePostpaidBillFromReadings = async (billId: string) => {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: { lease: { include: { room: true } }, items: true },
  });
  if (!bill || bill.mode !== 'POSTPAID') return bill;

  const [previousWater, currentWater, previousPower, currentPower] =
    await Promise.all([
      findReadingAtOrBefore({
        organizationId: bill.organizationId,
        roomId: bill.lease.roomId,
        meterType: 'WATER',
        date: bill.periodStart,
      }),
      findReadingAtOrBefore({
        organizationId: bill.organizationId,
        roomId: bill.lease.roomId,
        meterType: 'WATER',
        date: bill.periodEnd,
      }),
      findReadingAtOrBefore({
        organizationId: bill.organizationId,
        roomId: bill.lease.roomId,
        meterType: 'POWER',
        date: bill.periodStart,
      }),
      findReadingAtOrBefore({
        organizationId: bill.organizationId,
        roomId: bill.lease.roomId,
        meterType: 'POWER',
        date: bill.periodEnd,
      }),
    ]);

  if (!previousWater || !currentWater || !previousPower || !currentPower) {
    await failPostpaidBill(bill.id, '缺少本期水电起止读数');
    return prisma.bill.findUnique({
      where: { id: bill.id },
      include: { items: true },
    });
  }
  if (
    previousWater.id === currentWater.id ||
    previousPower.id === currentPower.id
  ) {
    await failPostpaidBill(bill.id, '缺少本期水电期末读数');
    return prisma.bill.findUnique({
      where: { id: bill.id },
      include: { items: true },
    });
  }

  try {
    calculateUtilityAmount({
      previousWater: previousWater.value,
      currentWater: currentWater.value,
      waterUnitPrice: bill.lease.waterUnitPrice,
      previousPower: previousPower.value,
      currentPower: currentPower.value,
      powerUnitPrice: bill.lease.powerUnitPrice,
    });
  } catch (error) {
    await failPostpaidBill(
      bill.id,
      error instanceof Error ? error.message : '水电出账失败'
    );
    return prisma.bill.findUnique({
      where: { id: bill.id },
      include: { items: true },
    });
  }

  const { waterAmount, powerAmount } = calculateUtilityLineAmounts({
    previousWater: previousWater.value,
    currentWater: currentWater.value,
    waterUnitPrice: bill.lease.waterUnitPrice,
    previousPower: previousPower.value,
    currentPower: currentPower.value,
    powerUnitPrice: bill.lease.powerUnitPrice,
  });

  await prisma.$transaction([
    prisma.billItem.updateMany({
      where: { billId: bill.id, type: 'WATER' },
      data: {
        amount: waterAmount,
        status: 'UNPAID',
        previousWater: previousWater.value,
        currentWater: currentWater.value,
        waterUnitPrice: bill.lease.waterUnitPrice,
      },
    }),
    prisma.billItem.updateMany({
      where: { billId: bill.id, type: 'POWER' },
      data: {
        amount: powerAmount,
        status: 'UNPAID',
        previousPower: previousPower.value,
        currentPower: currentPower.value,
        powerUnitPrice: bill.lease.powerUnitPrice,
      },
    }),
    prisma.bill.update({
      where: { id: bill.id },
      data: { status: 'UNPAID', failureReason: null },
    }),
  ]);
  await refreshBillTotals(bill.id);

  return prisma.bill.findUnique({
    where: { id: bill.id },
    include: { items: true },
  });
};

export const tryCreateMonthlyBill = async (
  leaseId: string,
  billingDate: Date
) => {
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: { bills: true },
  });
  if (!lease) return null;

  const children = await prisma.bill.findMany({
    where: { leaseId, billingDate: startOfDay(billingDate).toDate() },
    include: { items: true },
  });
  const hasBlockedBill = children.some(
    (bill) => bill.status === 'BILLING' || bill.status === 'FAILED'
  );
  if (!children.length || hasBlockedBill) return null;

  const totalAmount = children.reduce(
    (sum, bill) => sum.plus(bill.totalAmount),
    new Prisma.Decimal(0)
  );
  const monthlyBill = await prisma.monthlyBill.upsert({
    where: {
      leaseId_billingDate: {
        leaseId,
        billingDate: startOfDay(billingDate).toDate(),
      },
    },
    create: {
      organizationId: lease.organizationId,
      leaseId,
      tenantName: lease.tenantName,
      tenantPhone: lease.tenantPhone,
      billingDate: startOfDay(billingDate).toDate(),
      dueDate: startOfDay(billingDate).add(lease.graceDays, 'day').toDate(),
      totalAmount,
      status: 'UNPAID',
    },
    update: { totalAmount },
  });

  await prisma.bill.updateMany({
    where: {
      leaseId,
      billingDate: startOfDay(billingDate).toDate(),
      monthlyBillId: null,
    },
    data: { monthlyBillId: monthlyBill.id },
  });

  await refreshMonthlyBillTotals(monthlyBill.id);
  return prisma.monthlyBill.findUnique({
    where: { id: monthlyBill.id },
    include: { bills: { include: { items: true } }, payments: true },
  });
};

export const generateLeaseBills = async (
  leaseId: string,
  today = new Date(),
  options?: { onlyCurrentPeriod?: boolean }
) => {
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: {
      fees: true,
      bills: true,
      room: { include: { apartment: true } },
    },
  });
  if (!lease) return;

  const billingEnd = getLeaseBillGenerationEnd(lease, today);
  const billingDates = getBillingDatesThrough({
    leaseStartDate: lease.startDate,
    leaseEndDate: billingEnd,
    cycle: lease.cycle,
    today,
  });
  const datesToGenerate =
    options?.onlyCurrentPeriod && billingDates.length > 0
      ? [billingDates[billingDates.length - 1]]
      : billingDates;
  const generatedIds: string[] = [];

  for (const billingDate of datesToGenerate) {
    const periods = calculateBillingPeriods({
      leaseStartDate: lease.startDate,
      leaseEndDate: billingEnd,
      cycle: lease.cycle,
      billingDate,
    });
    const dueDate = startOfDay(billingDate)
      .add(lease.graceDays, 'day')
      .toDate();
    const prepaid = await prisma.bill.upsert({
      where: {
        leaseId_billingDate_mode: {
          leaseId: lease.id,
          billingDate: startOfDay(billingDate).toDate(),
          mode: 'PREPAID',
        },
      },
      create: {
        organizationId: lease.organizationId,
        leaseId: lease.id,
        mode: 'PREPAID',
        billingDate: startOfDay(billingDate).toDate(),
        periodStart: periods.prepaid.start,
        periodEnd: periods.prepaid.end,
        dueDate,
        status: 'UNPAID',
        items: {
          create: [
            {
              type: 'RENT',
              name: '房租',
              amount: lease.rentAmount,
              status: 'UNPAID',
            },
            ...lease.fees.map((fee) => ({
              type:
                fee.type === 'OTHER' ? classifyFeeItemType(fee.name) : fee.type,
              name: fee.name,
              amount: fee.amount,
              status: 'UNPAID' as const,
            })),
          ],
        },
      },
      update: {},
    });
    await refreshBillTotals(prepaid.id);
    generatedIds.push(prepaid.id);

    if (
      shouldGeneratePostpaidBill({
        leaseStartDate: lease.startDate,
        billingDate,
      })
    ) {
      const postpaid = await prisma.bill.upsert({
        where: {
          leaseId_billingDate_mode: {
            leaseId: lease.id,
            billingDate: startOfDay(billingDate).toDate(),
            mode: 'POSTPAID',
          },
        },
        create: {
          organizationId: lease.organizationId,
          leaseId: lease.id,
          mode: 'POSTPAID',
          billingDate: startOfDay(billingDate).toDate(),
          periodStart: periods.postpaid.start,
          periodEnd: periods.postpaid.end,
          dueDate,
          status: 'BILLING',
          items: {
            create: [
              {
                type: 'WATER',
                name: '水费',
                amount: 0,
                status: 'BILLING',
                waterUnitPrice: lease.waterUnitPrice,
              },
              {
                type: 'POWER',
                name: '电费',
                amount: 0,
                status: 'BILLING',
                powerUnitPrice: lease.powerUnitPrice,
              },
            ],
          },
        },
        update: {},
      });
      generatedIds.push(postpaid.id);
      if (postpaid.status === 'BILLING' || postpaid.status === 'FAILED') {
        await completePostpaidBillFromReadings(postpaid.id);
      }
    }

    await tryCreateMonthlyBill(lease.id, billingDate);
  }

  return generatedIds;
};

type CurrentLeaseBillDependencies = {
  findCurrentLeases: (organizationId: string) => Promise<Array<{ id: string }>>;
  generateLeaseBillsForLease: (
    leaseId: string,
    today: Date
  ) => Promise<string[] | undefined>;
};

const defaultCurrentLeaseBillDependencies: CurrentLeaseBillDependencies = {
  findCurrentLeases: (organizationId) =>
    prisma.lease.findMany({
      where: { organizationId, status: 'ACTIVE' },
      select: { id: true },
    }),
  generateLeaseBillsForLease: generateLeaseBills,
};

export const generateCurrentLeaseBills = async (
  organizationId: string,
  today = new Date(),
  dependencies: CurrentLeaseBillDependencies = defaultCurrentLeaseBillDependencies
) => {
  const leases = await dependencies.findCurrentLeases(organizationId);
  const generated = await Promise.all(
    leases.map((lease) =>
      dependencies.generateLeaseBillsForLease(lease.id, today)
    )
  );

  return {
    leaseCount: leases.length,
    billIds: generated.flatMap((ids) => ids ?? []),
  };
};

export const generateActiveAutoRenewBills = async (organizationId: string) => {
  await generateCurrentLeaseBills(organizationId);
};

export const retryPostpaidBillAndMonthlyBill = async (billId: string) => {
  const bill = await completePostpaidBillFromReadings(billId);
  if (!bill) return null;
  await tryCreateMonthlyBill(bill.leaseId, bill.billingDate);
  return prisma.bill.findUnique({
    where: { id: bill.id },
    include: { items: true, monthlyBill: true },
  });
};

export const recordMonthlyBillPayment = async ({
  monthlyBillId,
  userId,
  amount,
  method,
  note,
}: {
  monthlyBillId: string;
  userId: string;
  amount: Prisma.Decimal.Value;
  method: string;
  note?: string;
}) => {
  const current = await prisma.monthlyBill.findUnique({
    where: { id: monthlyBillId },
    include: {
      bills: { include: { payments: { where: { monthlyBillId: null } } } },
    },
  });
  if (!current) throw new HttpError(404, '月度账单不存在');
  const childBillPaymentsCount = current.bills.reduce(
    (sum, bill) => sum + bill.payments.length,
    0
  );
  assertMonthlyBillPaymentAllowed({
    ...current,
    childBillPaymentsCount,
    amount,
  });

  let unapplied = new Prisma.Decimal(amount);
  const payments = [];
  for (const bill of current.bills) {
    if (unapplied.lessThanOrEqualTo(0)) break;
    const billRemaining = remainingAmountFor(bill);
    if (billRemaining.lessThanOrEqualTo(0)) continue;
    const billAmount = unapplied.greaterThan(billRemaining)
      ? billRemaining
      : unapplied;
    payments.push(
      await prisma.payment.create({
        data: {
          billId: bill.id,
          monthlyBillId,
          userId,
          amount: billAmount,
          method,
          note,
          status: 'COMPLETED',
        },
      })
    );
    unapplied = unapplied.minus(billAmount);
  }

  await Promise.all(current.bills.map((bill) => refreshBillTotals(bill.id)));
  await refreshMonthlyBillTotals(monthlyBillId);
  return payments[0];
};

export const recordBillPayment = async ({
  billId,
  organizationId,
  userId,
  amount,
  method,
  note,
}: {
  billId: string;
  organizationId: string;
  userId: string;
  amount: Prisma.Decimal.Value;
  method: string;
  note?: string;
}) => {
  const bill = await prisma.bill.findFirst({
    where: { id: billId, organizationId },
    include: { monthlyBill: { include: { payments: true } } },
  });
  if (!bill) throw new HttpError(404, '账单不存在');
  if (bill.monthlyBill?.payments.length)
    throw new HttpError(400, '所属月度账单已有收款，请继续按月度账单收款');
  assertBillPaymentAllowed({ ...bill, amount });

  const payment = await prisma.payment.create({
    data: { billId, userId, amount, method, note, status: 'COMPLETED' },
  });
  await refreshBillTotals(billId);
  return payment;
};
