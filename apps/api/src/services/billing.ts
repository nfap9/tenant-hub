import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import {
  cycleMonths,
  getLeaseBillGenerationEnd,
  type LeaseCycle,
} from './leaseLifecycle.js';
import { refreshDepositStatus } from './deposit.js';
import { HttpError } from '../utils/http.js';
import {
  createTransaction,
  getCategoryFromBillItemType,
} from './transaction.js';

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
  if (status === 'PAID' || status === 'VOID' || status === 'REFUNDED')
    throw new HttpError(400, '该账单已结清或作废，不能继续收款');
  if (status === 'BILLING' || status === 'FAILED')
    throw new HttpError(400, '该账单尚未出账完成，不能收款');
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

const BILL_OPERATION_GUARDS: Record<
  string,
  { allowVoid: boolean; allowRefund: boolean; allowDelete: boolean }
> = {
  UNPAID: { allowVoid: true, allowRefund: false, allowDelete: true },
  PARTIAL_PAID: { allowVoid: true, allowRefund: false, allowDelete: true },
  BILLING: { allowVoid: true, allowRefund: false, allowDelete: true },
  FAILED: { allowVoid: true, allowRefund: false, allowDelete: true },
  PAID: { allowVoid: false, allowRefund: true, allowDelete: false },
  REFUNDED: { allowVoid: false, allowRefund: false, allowDelete: false },
  VOID: { allowVoid: false, allowRefund: false, allowDelete: false },
};

export const assertBillOperation = (
  status: string,
  operation: 'void' | 'refund' | 'delete'
) => {
  const guard = BILL_OPERATION_GUARDS[status];
  if (!guard) throw new HttpError(400, '未知账单状态');
  if (
    !guard[
      `allow${operation.charAt(0).toUpperCase() + operation.slice(1)}` as keyof typeof guard
    ]
  )
    throw new HttpError(400, `当前账单状态不允许此操作`);
};

export const voidBill = async (billId: string, organizationId: string) => {
  const bill = await prisma.bill.findFirst({
    where: { id: billId, organizationId },
  });
  if (!bill) throw new HttpError(404, '账单不存在');
  if (bill.note === 'LEASE_SETTLEMENT')
    throw new HttpError(400, '退租结算账单不能作废，请通过退租流程处理');
  assertBillOperation(bill.status, 'void');

  await prisma.$transaction(async (tx) => {
    await tx.billItem.updateMany({
      where: { billId },
      data: { status: 'VOID', amount: 0 },
    });
    await tx.bill.update({
      where: { id: billId },
      data: { status: 'VOID', totalAmount: 0, failureReason: null },
    });

    if (bill.mode === 'DEPOSIT') {
      const deposit = await tx.deposit.findUnique({
        where: { billId },
      });
      if (deposit && deposit.status === 'UNPAID') {
        await tx.deposit.delete({ where: { id: deposit.id } });
      }
    }
  });

  return prisma.bill.findUnique({
    where: { id: billId },
    include: { items: true },
  });
};

export const refundBill = async ({
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
  });
  if (!bill) throw new HttpError(404, '账单不存在');
  assertBillOperation(bill.status, 'refund');

  const refundAmount = new Prisma.Decimal(amount);
  if (refundAmount.lessThanOrEqualTo(0))
    throw new HttpError(400, '退款金额必须大于 0');
  const netPaid = new Prisma.Decimal(bill.paidAmount);
  if (refundAmount.greaterThan(netPaid))
    throw new HttpError(400, '退款金额不能超过已付金额');

  const payment = await prisma.payment.create({
    data: {
      billId,
      userId,
      type: 'REFUND',
      amount: refundAmount,
      method,
      note,
      status: 'COMPLETED',
    },
  });

  // 创建收支记录
  const billWithLease = await prisma.bill.findUnique({
    where: { id: billId },
    include: {
      items: true,
      lease: { include: { room: { include: { apartment: true } } } },
    },
  });
  if (billWithLease) {
    const category = 'BILL_REFUND';
    const description = `${billWithLease.lease.room.apartment.name} - ${billWithLease.lease.room.roomNo} 账单退款`;

    await createTransaction({
      organizationId: billWithLease.organizationId,
      type: 'EXPENSE',
      category,
      amount: refundAmount,
      method,
      description,
      note,
      operatorId: userId,
      sourceType: 'BILL_PAYMENT',
      sourceId: payment.id,
      billId,
      leaseId: billWithLease.leaseId,
      apartmentId: billWithLease.lease.room.apartmentId,
    });
  }

  await refreshBillTotals(billId);

  return prisma.bill.findUnique({
    where: { id: billId },
    include: { items: true, payments: true },
  });
};

const classifyFeeItemType = (name: string) => {
  if (name.includes('网')) return 'NETWORK' as const;
  if (name.includes('物业') || name.includes('管理'))
    return 'MANAGEMENT' as const;
  return 'OTHER' as const;
};

export const refreshBillTotals = async (billId: string) => {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: { items: true, payments: true },
  });
  if (!bill) return;

  // 退租结算账单手动管理状态，跳过自动计算
  if (bill.note === 'LEASE_SETTLEMENT') return;

  const totalAmount = bill.items.reduce(
    (sum, item) => sum.plus(item.amount),
    new Prisma.Decimal(0)
  );
  const netPaidAmount = bill.payments.reduce(
    (sum, payment) =>
      payment.type === 'REFUND'
        ? sum.minus(payment.amount)
        : sum.plus(payment.amount),
    new Prisma.Decimal(0)
  );
  const totalRefunded = bill.payments
    .filter((p) => p.type === 'REFUND')
    .reduce((sum, p) => sum.plus(p.amount), new Prisma.Decimal(0));

  const status =
    bill.status === 'VOID'
      ? 'VOID'
      : totalRefunded.greaterThanOrEqualTo(
            bill.payments
              .filter((p) => p.type === 'RECEIVE')
              .reduce((sum, p) => sum.plus(p.amount), new Prisma.Decimal(0))
          ) && totalRefunded.greaterThan(0)
        ? 'REFUNDED'
        : netPaidAmount.greaterThanOrEqualTo(totalAmount)
          ? 'PAID'
          : netPaidAmount.greaterThan(0)
            ? 'PARTIAL_PAID'
            : bill.items.some((item) => item.status === 'FAILED')
              ? 'FAILED'
              : bill.items.some((item) => item.status === 'BILLING')
                ? 'BILLING'
                : 'UNPAID';

  await prisma.bill.update({
    where: { id: billId },
    data: { totalAmount, paidAmount: netPaidAmount, status },
  });
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
  if (lease.status === 'DRAFT' || lease.status === 'EXPIRED') return;

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
    const dueDate = startOfDay(billingDate).toDate();
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
  return completePostpaidBillFromReadings(billId);
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
    include: {
      items: true,
      lease: { include: { room: { include: { apartment: true } } } },
    },
  });
  if (!bill) throw new HttpError(404, '账单不存在');
  assertBillPaymentAllowed({ ...bill, amount });

  const payment = await prisma.payment.create({
    data: { billId, userId, amount, method, note, status: 'COMPLETED' },
  });

  // 创建收支记录（按账单明细项拆分）
  if (
    bill.items.length > 0 &&
    new Prisma.Decimal(bill.totalAmount).greaterThan(0)
  ) {
    const totalAmount = new Prisma.Decimal(bill.totalAmount);
    const paymentAmount = new Prisma.Decimal(amount);
    const apartmentName = bill.lease.room.apartment.name;
    const roomNo = bill.lease.room.roomNo;

    for (const item of bill.items) {
      const itemAmount = new Prisma.Decimal(item.amount);
      if (itemAmount.lessThanOrEqualTo(0)) continue;

      // 按金额比例拆分
      const splitAmount = itemAmount
        .div(totalAmount)
        .mul(paymentAmount)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

      if (splitAmount.lessThanOrEqualTo(0)) continue;

      const category = getCategoryFromBillItemType(item.type);
      const description =
        bill.note === 'LEASE_SETTLEMENT'
          ? `${apartmentName} - ${roomNo} 退租结算${item.name}`
          : `${apartmentName} - ${roomNo} ${item.name}`;

      await createTransaction({
        organizationId: bill.organizationId,
        type: 'INCOME',
        category,
        amount: splitAmount,
        method,
        description,
        note,
        operatorId: userId,
        sourceType: 'BILL_PAYMENT',
        sourceId: payment.id,
        billId,
        leaseId: bill.leaseId,
        apartmentId: bill.lease.room.apartmentId,
      });
    }
  }

  // 退租结算账单手动管理状态
  if (bill.note === 'LEASE_SETTLEMENT') {
    const updatedBill = await prisma.bill.findUnique({
      where: { id: billId },
    });
    if (updatedBill) {
      const newPaidAmount = updatedBill.paidAmount.plus(amount);
      const isPaid = newPaidAmount.greaterThanOrEqualTo(
        updatedBill.totalAmount
      );
      await prisma.bill.update({
        where: { id: billId },
        data: {
          paidAmount: newPaidAmount,
          status: isPaid ? 'PAID' : 'PARTIAL_PAID',
        },
      });
    }
  } else {
    await refreshBillTotals(billId);
  }

  if (bill.mode === 'DEPOSIT') {
    const deposit = await prisma.deposit.findUnique({
      where: { billId: bill.id },
    });
    if (deposit) {
      await prisma.deposit.update({
        where: { id: deposit.id },
        data: { paidAmount: deposit.paidAmount.plus(amount) },
      });
      await refreshDepositStatus(deposit.id);
    }
  }

  return payment;
};
