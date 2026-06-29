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

const startOfDay = (date: Date) => dayjs.utc(date).startOf('day');

/**
 * 根据租约信息和计费日期计算预付和后付的计费周期
 * @param leaseStartDate - 租约开始日期
 * @param leaseEndDate - 租约结束日期
 * @param cycle - 付款周期
 * @param billingDate - 计费日期
 * @returns 预付周期和后付周期
 */
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

/**
 * 判断是否需要生成后付账单
 * @param leaseStartDate - 租约开始日期
 * @param billingDate - 计费日期
 * @returns 计费日期晚于租约开始日期时返回 true
 */
export const shouldGeneratePostpaidBill = ({
  leaseStartDate,
  billingDate,
}: Pick<BillingPeriodInput, 'leaseStartDate' | 'billingDate'>) =>
  startOfDay(billingDate).isAfter(startOfDay(leaseStartDate), 'day');

/**
 * 获取从租约开始到指定日期之间的所有计费日期
 * @param leaseStartDate - 租约开始日期
 * @param leaseEndDate - 租约结束日期
 * @param cycle - 付款周期
 * @param today - 判断基准日期，默认为当前日期
 * @returns 计费日期数组
 */
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

/**
 * 获取当前月份的账单窗口
 * @param today - 基准日期，默认为当前日期
 * @returns 账单窗口的开始和结束日期
 */
export const getCurrentMonthBillWindow = (today = new Date()) => ({
  start: startOfDay(today).startOf('month').toDate(),
  end: startOfDay(today).add(1, 'month').startOf('month').toDate(),
});

/**
 * 根据计费日期生成账单月份标签
 * @param billingDate - 计费日期
 * @returns 如 "2024年6月" 的字符串
 */
export const getBillMonthLabel = (billingDate: Date) => {
  const date = startOfDay(billingDate);
  return `${date.year()}年${date.month() + 1}月`;
};

/**
 * 计算水电总费用
 * @param previousWater - 上期水表读数
 * @param currentWater - 本期水表读数
 * @param waterUnitPrice - 水费单价
 * @param previousPower - 上期电表读数
 * @param currentPower - 本期电表读数
 * @param powerUnitPrice - 电费单价
 * @returns 水电总费用
 * @throws 当本期读数小于上期读数时抛出错误
 */
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

/**
 * 分别计算水费和电费金额
 * @param previousWater - 上期水表读数
 * @param currentWater - 本期水表读数
 * @param waterUnitPrice - 水费单价
 * @param previousPower - 上期电表读数
 * @param currentPower - 本期电表读数
 * @param powerUnitPrice - 电费单价
 * @returns 水费金额和电费金额
 */
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

/**
 * 断言账单允许收款操作
 * @param status - 账单状态
 * @param totalAmount - 账单总金额
 * @param paidAmount - 已付金额
 * @param amount - 本次收款金额
 * @throws 当不允许收款时抛出 HttpError
 */
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

const BILL_OPERATION_GUARDS: Record<
  string,
  { allowVoid: boolean; allowDelete: boolean }
> = {
  UNPAID: { allowVoid: true, allowDelete: true },
  PAID: { allowVoid: false, allowDelete: false },
  VOID: { allowVoid: false, allowDelete: false },
};

/**
 * 断言账单允许指定的操作
 * @param status - 账单状态
 * @param operation - 操作类型：void 或 delete
 * @throws 当当前状态不允许该操作时抛出 HttpError
 */
export const assertBillOperation = (
  status: string,
  operation: 'void' | 'delete'
) => {
  const guard = BILL_OPERATION_GUARDS[status];
  if (!guard) throw new HttpError(400, '未知账单状态');
  const key =
    `allow${operation.charAt(0).toUpperCase() + operation.slice(1)}` as keyof typeof guard;
  if (!guard[key]) throw new HttpError(400, `当前账单状态不允许此操作`);
};

/**
 * 作废账单
 * @param billId - 账单 ID
 * @param organizationId - 组织 ID
 * @returns 作废后的账单（含账单项目）
 * @throws 当账单不存在或状态不允许作废时抛出 HttpError
 */
export const voidBill = async (billId: string, organizationId: string) => {
  const bill = await prisma.bill.findFirst({
    where: { id: billId, organizationId },
  });
  if (!bill) throw new HttpError(404, '账单不存在');
  assertBillOperation(bill.status, 'void');

  await prisma.$transaction(async (tx) => {
    await tx.billItem.updateMany({
      where: { billId },
      data: { amount: 0 },
    });
    await tx.bill.update({
      where: { id: billId },
      data: { status: 'VOID', totalAmount: 0 },
    });

    const deposit = await tx.deposit.findUnique({
      where: { billId },
    });
    if (deposit && deposit.status === 'UNPAID') {
      await tx.deposit.delete({ where: { id: deposit.id } });
    }
  });

  return prisma.bill.findUnique({
    where: { id: billId },
    include: { items: true },
  });
};

/**
 * 刷新账单总金额、已付金额和状态
 * @param billId - 账单 ID
 */
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
  const netPaidAmount = bill.payments.reduce(
    (sum, payment) => sum.plus(payment.amount),
    new Prisma.Decimal(0)
  );

  const status =
    bill.status === 'VOID'
      ? 'VOID'
      : netPaidAmount.greaterThanOrEqualTo(totalAmount)
        ? 'PAID'
        : 'UNPAID';

  await prisma.bill.update({
    where: { id: billId },
    data: { totalAmount, paidAmount: netPaidAmount, status },
  });
};

/**
 * 查找指定日期或之前的最近一条抄表记录
 * @param organizationId - 组织 ID
 * @param roomId - 房间 ID
 * @param meterType - 表类型
 * @param date - 查询日期
 * @returns 最近的抄表记录，不存在返回 null
 */
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
    },
    orderBy: { readingDate: 'desc' },
  });

/**
 * 根据水电表读数完成后付账单
 * @param billId - 账单 ID
 * @returns 更新后的账单（含账单项目），若读数不足则返回原账单
 */
export const completePostpaidBillFromReadings = async (billId: string) => {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: { lease: { include: { room: true } }, items: true },
  });
  if (!bill) return bill;

  const waterItem = bill.items.find(
    (item) => item.category === 'UTILITY' && item.name === '水费'
  );
  const powerItem = bill.items.find(
    (item) => item.category === 'UTILITY' && item.name === '电费'
  );
  if (!waterItem || !powerItem) return bill;

  const [previousWater, currentWater, previousPower, currentPower] =
    await Promise.all([
      findReadingAtOrBefore({
        organizationId: bill.organizationId,
        roomId: bill.lease.roomId,
        meterType: 'WATER',
        date: waterItem.periodStart,
      }),
      findReadingAtOrBefore({
        organizationId: bill.organizationId,
        roomId: bill.lease.roomId,
        meterType: 'WATER',
        date: waterItem.periodEnd,
      }),
      findReadingAtOrBefore({
        organizationId: bill.organizationId,
        roomId: bill.lease.roomId,
        meterType: 'POWER',
        date: powerItem.periodStart,
      }),
      findReadingAtOrBefore({
        organizationId: bill.organizationId,
        roomId: bill.lease.roomId,
        meterType: 'POWER',
        date: powerItem.periodEnd,
      }),
    ]);

  if (!previousWater || !currentWater || !previousPower || !currentPower) {
    return bill;
  }
  if (
    previousWater.id === currentWater.id ||
    previousPower.id === currentPower.id
  ) {
    return bill;
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
  } catch {
    return bill;
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
    prisma.billItem.update({
      where: { id: waterItem.id },
      data: { amount: waterAmount },
    }),
    prisma.billItem.update({
      where: { id: powerItem.id },
      data: { amount: powerAmount },
    }),
    prisma.bill.update({
      where: { id: bill.id },
      data: { status: 'UNPAID' },
    }),
  ]);
  await refreshBillTotals(bill.id);

  return prisma.bill.findUnique({
    where: { id: bill.id },
    include: { items: true },
  });
};

type LeaseWithRoomAndFees = Prisma.LeaseGetPayload<{
  include: { fees: true; room: { include: { apartment: true } } };
}>;

const feeItemCategory = (type: string): 'FEE' | 'OTHER' =>
  type === 'OTHER' ? 'OTHER' : 'FEE';

/**
 * 为指定计费日生成账单，包含预付项（房租、杂费）与后付项（水电）
 * @param lease - 租约信息（含费用、房间、公寓）
 * @param billingDate - 计费日期
 * @param billingEnd - 账单生成结束日期
 * @returns 生成的账单（含账单项目）
 */
const generateBillForBillingDate = async (
  lease: LeaseWithRoomAndFees,
  billingDate: Date,
  billingEnd: Date
) => {
  const existing = await prisma.bill.findFirst({
    where: {
      leaseId: lease.id,
      billingDate: startOfDay(billingDate).toDate(),
      deletedAt: null,
    },
  });
  if (existing) {
    return prisma.bill.findUnique({
      where: { id: existing.id },
      include: { items: true },
    });
  }

  const periods = calculateBillingPeriods({
    leaseStartDate: lease.startDate,
    leaseEndDate: billingEnd,
    cycle: lease.rentCycle,
    billingDate,
  });
  const dueDate = startOfDay(billingDate).toDate();

  const baseItems: Prisma.BillItemCreateWithoutBillInput[] = [
    {
      category: 'RENT',
      name: '房租',
      amount: lease.rentAmount,
      periodStart: periods.prepaid.start,
      periodEnd: periods.prepaid.end,
    },
    ...lease.fees.map((fee) => ({
      category: feeItemCategory(fee.type),
      name: fee.name,
      amount: fee.amount,
      periodStart: periods.prepaid.start,
      periodEnd: periods.prepaid.end,
    })),
  ];

  const hasPostpaid = shouldGeneratePostpaidBill({
    leaseStartDate: lease.startDate,
    billingDate,
  });

  if (hasPostpaid) {
    baseItems.push(
      {
        category: 'UTILITY',
        name: '水费',
        amount: 0,
        periodStart: periods.postpaid.start,
        periodEnd: periods.postpaid.end,
      },
      {
        category: 'UTILITY',
        name: '电费',
        amount: 0,
        periodStart: periods.postpaid.start,
        periodEnd: periods.postpaid.end,
      }
    );
  }

  const billResult = await prisma.bill.create({
    data: {
      organizationId: lease.organizationId,
      leaseId: lease.id,
      billingMethod: 'AUTO',
      billingDate: startOfDay(billingDate).toDate(),
      dueDate,
      status: 'UNPAID',
      items: { create: baseItems },
    },
  });

  if (hasPostpaid) {
    await completePostpaidBillFromReadings(billResult.id);
  }

  return prisma.bill.findUnique({
    where: { id: billResult.id },
    include: { items: true },
  });
};

/**
 * 为租约生成账单
 * @param leaseId - 租约 ID
 * @param today - 账单生成基准日期，默认为当前日期
 * @param options - 可选配置（是否仅生成当前周期）
 * @returns 生成的账单 ID 列表
 */
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
    cycle: lease.rentCycle,
    today,
  });
  const datesToGenerate =
    options?.onlyCurrentPeriod && billingDates.length > 0
      ? [billingDates[billingDates.length - 1]]
      : billingDates;
  const generatedIds: string[] = [];

  for (const billingDate of datesToGenerate) {
    const bill = await generateBillForBillingDate(
      lease,
      billingDate,
      billingEnd
    );
    if (bill) {
      generatedIds.push(bill.id);
    }
  }

  return generatedIds;
};

export type HistoricalBillRow = {
  billingDate: Date;
  currentWater: number;
  currentPower: number;
  settled: boolean;
};

/**
 * 根据用户填写的历史账单记录生成历史账单，并自动处理结清
 * @param leaseId - 租约 ID
 * @param rows - 历史账单行数据
 * @param base - 水表和电表的初始底数
 * @param userId - 操作用户 ID
 */
export const generateHistoricalLeaseBills = async (
  leaseId: string,
  rows: HistoricalBillRow[],
  base: { baseWater: number; basePower: number },
  userId: string
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

  const billingEnd = getLeaseBillGenerationEnd(lease, new Date());
  const sortedRows = [...rows].sort(
    (a, b) =>
      startOfDay(a.billingDate).valueOf() - startOfDay(b.billingDate).valueOf()
  );

  const leaseStart = startOfDay(lease.startDate).toDate();
  let previousWater = base.baseWater;
  let previousPower = base.basePower;

  await prisma.meterReading.createMany({
    data: [
      {
        organizationId: lease.organizationId,
        apartmentId: lease.room.apartmentId,
        roomId: lease.roomId,
        leaseId: lease.id,
        meterType: 'WATER',
        readingDate: leaseStart,
        value: base.baseWater,
      },
      {
        organizationId: lease.organizationId,
        apartmentId: lease.room.apartmentId,
        roomId: lease.roomId,
        leaseId: lease.id,
        meterType: 'POWER',
        readingDate: leaseStart,
        value: base.basePower,
      },
    ],
  });

  for (const row of sortedRows) {
    const billingDate = startOfDay(row.billingDate).toDate();
    const periods = calculateBillingPeriods({
      leaseStartDate: lease.startDate,
      leaseEndDate: billingEnd,
      cycle: lease.rentCycle,
      billingDate,
    });

    const readings: Prisma.MeterReadingCreateManyInput[] = [];
    if (
      !startOfDay(periods.postpaid.start).isSame(
        startOfDay(lease.startDate),
        'day'
      )
    ) {
      readings.push(
        {
          organizationId: lease.organizationId,
          apartmentId: lease.room.apartmentId,
          roomId: lease.roomId,
          leaseId: lease.id,
          meterType: 'WATER',
          readingDate: periods.postpaid.start,
          value: previousWater,
        },
        {
          organizationId: lease.organizationId,
          apartmentId: lease.room.apartmentId,
          roomId: lease.roomId,
          leaseId: lease.id,
          meterType: 'POWER',
          readingDate: periods.postpaid.start,
          value: previousPower,
        }
      );
    }
    readings.push(
      {
        organizationId: lease.organizationId,
        apartmentId: lease.room.apartmentId,
        roomId: lease.roomId,
        leaseId: lease.id,
        meterType: 'WATER',
        readingDate: periods.postpaid.end,
        value: row.currentWater,
      },
      {
        organizationId: lease.organizationId,
        apartmentId: lease.room.apartmentId,
        roomId: lease.roomId,
        leaseId: lease.id,
        meterType: 'POWER',
        readingDate: periods.postpaid.end,
        value: row.currentPower,
      }
    );
    await prisma.meterReading.createMany({ data: readings });

    const bill = await generateBillForBillingDate(
      lease,
      billingDate,
      billingEnd
    );

    if (row.settled && bill) {
      const method = '历史结清';
      const note = '签约时历史账单已结清';
      if (new Prisma.Decimal(bill.totalAmount).greaterThan(0)) {
        await recordBillPayment({
          billId: bill.id,
          organizationId: lease.organizationId,
          userId,
          amount: bill.totalAmount,
          method,
          note,
        });
      }
    }

    previousWater = row.currentWater;
    previousPower = row.currentPower;
  }
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

/**
 * 为当前组织的所有活跃租约生成账单
 * @param organizationId - 组织 ID
 * @param today - 账单生成基准日期，默认为当前日期
 * @param dependencies - 依赖注入（用于测试）
 * @returns 生成的租约数量和账单 ID 列表
 */
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

/**
 * 为活跃租约生成账单（保留旧别名）
 * @param organizationId - 组织 ID
 */
export const generateActiveAutoRenewBills = async (organizationId: string) => {
  await generateCurrentLeaseBills(organizationId);
};

/**
 * 重试后付账单和月账单
 * @param billId - 账单 ID
 * @returns 更新后的账单
 */
export const retryPostpaidBillAndMonthlyBill = async (billId: string) => {
  return completePostpaidBillFromReadings(billId);
};

/**
 * 记录账单收款
 * @param billId - 账单 ID
 * @param organizationId - 组织 ID
 * @param userId - 收款用户 ID
 * @param amount - 收款金额
 * @param method - 收款方式
 * @param note - 备注（可选）
 * @returns 创建的付款记录
 * @throws 当账单不存在或收款不合法时抛出 HttpError
 */
export const recordBillPayment = async ({
  billId,
  organizationId,
  userId,
  amount,
  method,
  note,
  paidAt,
}: {
  billId: string;
  organizationId: string;
  userId: string;
  amount: Prisma.Decimal.Value;
  method: string;
  note?: string;
  paidAt?: Date;
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
    data: { billId, userId, amount, method, note, paidAt },
  });

  await refreshBillTotals(billId);

  const deposit = await prisma.deposit.findUnique({
    where: { billId: bill.id },
  });
  if (deposit) {
    const paidAmount = deposit.paidAmount.plus(amount);
    await prisma.deposit.update({
      where: { id: deposit.id },
      data: {
        paidAmount,
        status: paidAmount.greaterThanOrEqualTo(deposit.amount)
          ? 'PAID'
          : 'UNPAID',
      },
    });
  }

  return payment;
};
