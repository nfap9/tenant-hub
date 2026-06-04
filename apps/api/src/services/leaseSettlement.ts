import { Prisma, DepositStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { HttpError } from '../utils/http.js';
import { calculateUtilityAmount } from './billing.js';
import { startOfLeaseDay } from './leaseLifecycle.js';
import {
  createTransaction,
  getCategoryFromBillItemType,
} from './transaction.js';

type DecimalValue = Prisma.Decimal.Value;

type SettlementCalculationInput = {
  depositPaidAmount: DecimalValue;
  rentAdjustmentAmount: DecimalValue;
  previousWater: DecimalValue;
  currentWater: DecimalValue;
  waterUnitPrice: DecimalValue;
  previousPower: DecimalValue;
  currentPower: DecimalValue;
  powerUnitPrice: DecimalValue;
  otherFeeAmount: DecimalValue;
  penaltyAmount: DecimalValue;
  compensationAmount: DecimalValue;
};

/**
 * 验证退租水电表读数合法性，确保当前读数不小于上次读数
 * @param previousWater - 上次水表读数
 * @param currentWater - 当前水表读数
 * @param previousPower - 上次电表读数
 * @param currentPower - 当前电表读数
 * @returns 无返回值，验证失败时抛出 Error
 */
export const validateMoveOutReadings = ({
  previousWater,
  currentWater,
  previousPower,
  currentPower,
}: Pick<
  SettlementCalculationInput,
  'previousWater' | 'currentWater' | 'previousPower' | 'currentPower'
>) => {
  if (new Prisma.Decimal(currentWater).lessThan(previousWater))
    throw new Error('退租水表读数不能小于上次读数');
  if (new Prisma.Decimal(currentPower).lessThan(previousPower))
    throw new Error('退租电表读数不能小于上次读数');
};

/**
 * 计算退租结算各项金额明细
 * @param input - 退租结算计算输入参数
 * @returns 包含水电费、押金退款、应收、应退及净额的对象
 */
export const calculateSettlementAmounts = (
  input: SettlementCalculationInput
) => {
  validateMoveOutReadings(input);

  const depositPaidAmount = new Prisma.Decimal(input.depositPaidAmount);

  const rentAdjustmentAmount = new Prisma.Decimal(input.rentAdjustmentAmount);
  const utilityAmount = calculateUtilityAmount(input);
  const otherFeeAmount = new Prisma.Decimal(input.otherFeeAmount ?? 0);
  const penaltyAmount = new Prisma.Decimal(input.penaltyAmount ?? 0);
  const compensationAmount = new Prisma.Decimal(input.compensationAmount ?? 0);

  const depositRefundAmount = depositPaidAmount;
  const rentReceivable = rentAdjustmentAmount.greaterThan(0)
    ? rentAdjustmentAmount
    : new Prisma.Decimal(0);
  const rentRefund = rentAdjustmentAmount.lessThan(0)
    ? rentAdjustmentAmount.abs()
    : new Prisma.Decimal(0);
  const receivableAmount = rentReceivable
    .plus(utilityAmount)
    .plus(otherFeeAmount)
    .plus(penaltyAmount)
    .plus(compensationAmount);
  const refundableAmount = depositPaidAmount.plus(rentRefund);
  const netAmount = receivableAmount.minus(refundableAmount);

  return {
    utilityAmount,
    depositRefundAmount,
    receivableAmount,
    refundableAmount,
    netAmount,
  };
};

/**
 * 根据净额判断退租结算方向
 * @param netAmount - 结算净额
 * @returns 'RECEIVE'（应收）| 'REFUND'（应退）| 'NONE'（已结清）
 */
export const getSettlementDirection = (netAmount: DecimalValue) => {
  const net = new Prisma.Decimal(netAmount);
  if (net.greaterThan(0)) return 'RECEIVE' as const;
  if (net.lessThan(0)) return 'REFUND' as const;
  return 'NONE' as const;
};

const latestReadingValue = async (
  organizationId: string,
  roomId: string,
  meterType: 'WATER' | 'POWER',
  date: Date
) => {
  const reading = await prisma.meterReading.findFirst({
    where: {
      organizationId,
      roomId,
      meterType,
      readingDate: { lte: date },
      status: { not: 'VOID' },
    },
    orderBy: { readingDate: 'desc' },
  });
  return reading?.value ?? new Prisma.Decimal(0);
};

/**
 * 获取退租结算预览数据（上次水电表读数）
 * @param leaseId - 租约 ID
 * @param organizationId - 组织 ID
 * @param terminatedAt - 退租日期
 * @returns 包含上次水表读数和电表读数的对象
 */
export const getLeaseSettlementPreview = async ({
  leaseId,
  organizationId,
  terminatedAt,
}: {
  leaseId: string;
  organizationId: string;
  terminatedAt: Date;
}) => {
  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, organizationId },
  });
  if (!lease) throw new HttpError(404, '租约不存在');
  const [previousWater, previousPower] = await Promise.all([
    latestReadingValue(organizationId, lease.roomId, 'WATER', terminatedAt),
    latestReadingValue(organizationId, lease.roomId, 'POWER', terminatedAt),
  ]);
  return { previousWater, previousPower };
};

/**
 * 创建退租结算单，生成结算账单，更新租约及房间状态，并自动结清未付账单
 * @param leaseId - 租约 ID
 * @param organizationId - 组织 ID
 * @param userId - 操作用户 ID
 * @param input - 退租结算输入数据，包含类型、日期、水电读数、各项金额及原因
 * @returns 包含 settlement（结算单）和 settlementBill（结算账单）的对象
 */
export const createLeaseSettlement = async ({
  leaseId,
  organizationId,
  userId,
  input,
}: {
  leaseId: string;
  organizationId: string;
  userId: string;
  input: {
    type: 'EXPIRED' | 'NEGOTIATED' | 'BREACH';
    reason?: string;
    terminatedAt: Date;
    rentAdjustmentAmount: DecimalValue;
    currentWater: DecimalValue;
    currentPower: DecimalValue;
    otherFeeAmount: DecimalValue;
    otherFeeReason?: string;
    penaltyAmount: DecimalValue;
    penaltyReason?: string;
    compensationAmount: DecimalValue;
    compensationReason?: string;
  };
}) => {
  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, organizationId },
    include: { room: { include: { apartment: true } }, deposit: true },
  });
  if (!lease) throw new HttpError(404, '租约不存在');
  if (lease.status !== 'ACTIVE')
    throw new HttpError(400, '仅有效租约可以退租结算');

  const existing = await prisma.leaseSettlement.findUnique({
    where: { leaseId },
  });
  if (existing) throw new HttpError(409, '该租约已有退租结算单');

  const [previousWater, previousPower] = await Promise.all([
    latestReadingValue(
      organizationId,
      lease.roomId,
      'WATER',
      input.terminatedAt
    ),
    latestReadingValue(
      organizationId,
      lease.roomId,
      'POWER',
      input.terminatedAt
    ),
  ]);

  const depositPaidAmount = lease.deposit?.paidAmount ?? new Prisma.Decimal(0);

  let amounts;
  try {
    amounts = calculateSettlementAmounts({
      depositPaidAmount,
      rentAdjustmentAmount: input.rentAdjustmentAmount,
      previousWater,
      currentWater: input.currentWater,
      waterUnitPrice: lease.waterUnitPrice,
      previousPower,
      currentPower: input.currentPower,
      powerUnitPrice: lease.powerUnitPrice,
      otherFeeAmount: input.otherFeeAmount,
      penaltyAmount: input.penaltyAmount,
      compensationAmount: input.compensationAmount,
    });
  } catch (error) {
    throw new HttpError(
      400,
      error instanceof Error ? error.message : '退租结算失败'
    );
  }

  const status = amounts.netAmount.equals(0) ? 'SETTLED' : 'PENDING';
  const netAbs = amounts.netAmount.abs();
  const billStatus = amounts.netAmount.greaterThan(0)
    ? 'UNPAID'
    : amounts.netAmount.lessThan(0)
      ? 'REFUNDED'
      : 'PAID';

  return prisma.$transaction(async (tx) => {
    let settlementBill: Awaited<ReturnType<typeof tx.bill.create>> | null =
      null;

    // 生成完整退租结算账单
    let billingDate = startOfLeaseDay(input.terminatedAt).toDate();
    if (
      startOfLeaseDay(lease.startDate).isSame(
        startOfLeaseDay(input.terminatedAt),
        'day'
      )
    ) {
      billingDate = new Date(billingDate.getTime() + 1000);
    }

    const rentReceivable = new Prisma.Decimal(
      input.rentAdjustmentAmount
    ).greaterThan(0)
      ? new Prisma.Decimal(input.rentAdjustmentAmount)
      : new Prisma.Decimal(0);
    const rentRefund = new Prisma.Decimal(input.rentAdjustmentAmount).lessThan(
      0
    )
      ? new Prisma.Decimal(input.rentAdjustmentAmount).abs()
      : new Prisma.Decimal(0);
    const depositRefund = amounts.depositRefundAmount;
    const utilityAmount = amounts.utilityAmount;
    const otherFeeAmount = new Prisma.Decimal(input.otherFeeAmount);
    const penaltyAmount = new Prisma.Decimal(input.penaltyAmount);
    const compensationAmount = new Prisma.Decimal(input.compensationAmount);

    const billItems: Array<{
      type:
        | 'UTILITY'
        | 'RENT'
        | 'DEPOSIT'
        | 'PENALTY'
        | 'COMPENSATION'
        | 'OTHER';
      name: string;
      amount: Prisma.Decimal;
    }> = [];

    if (utilityAmount.greaterThan(0)) {
      billItems.push({
        type: 'UTILITY',
        name: '退租水电费',
        amount: utilityAmount,
      });
    }
    if (rentReceivable.greaterThan(0)) {
      billItems.push({
        type: 'RENT',
        name: '退租房租补收',
        amount: rentReceivable,
      });
    }
    if (rentRefund.greaterThan(0)) {
      billItems.push({
        type: 'RENT',
        name: '退租房租退款',
        amount: rentRefund,
      });
    }
    if (depositRefund.greaterThan(0)) {
      billItems.push({
        type: 'DEPOSIT',
        name: '退租押金退款',
        amount: depositRefund,
      });
    }
    if (penaltyAmount.greaterThan(0)) {
      billItems.push({
        type: 'PENALTY',
        name: '违约金',
        amount: penaltyAmount,
      });
    }
    if (compensationAmount.greaterThan(0)) {
      billItems.push({
        type: 'COMPENSATION',
        name: '赔偿金',
        amount: compensationAmount,
      });
    }
    if (otherFeeAmount.greaterThan(0)) {
      billItems.push({
        type: 'OTHER',
        name: input.otherFeeReason || '退租其他费用',
        amount: otherFeeAmount,
      });
    }

    const itemTotal = billItems.reduce(
      (sum, item) => sum.plus(item.amount),
      new Prisma.Decimal(0)
    );

    settlementBill = await tx.bill.create({
      data: {
        organizationId,
        leaseId: lease.id,
        mode: 'DEPOSIT',
        billingDate,
        periodStart: billingDate,
        periodEnd: billingDate,
        dueDate: billingDate,
        status: billStatus,
        totalAmount: netAbs.greaterThan(0) ? netAbs : itemTotal,
        paidAmount: 0,
        note: 'LEASE_SETTLEMENT',
        items: {
          create: billItems,
        },
      },
    });

    const settlement = await tx.leaseSettlement.create({
      data: {
        organizationId,
        leaseId: lease.id,
        roomId: lease.roomId,
        billId: settlementBill.id,
        type: input.type,
        reason: input.reason,
        terminatedAt: input.terminatedAt,
        depositAmount: lease.depositAmount,
        depositRefundAmount: amounts.depositRefundAmount,
        rentAdjustmentAmount: input.rentAdjustmentAmount,
        previousWater,
        currentWater: input.currentWater,
        previousPower,
        currentPower: input.currentPower,
        waterUnitPrice: lease.waterUnitPrice,
        powerUnitPrice: lease.powerUnitPrice,
        utilityAmount: amounts.utilityAmount,
        otherFeeAmount: input.otherFeeAmount,
        otherFeeReason: input.otherFeeReason,
        penaltyAmount: input.penaltyAmount,
        penaltyReason: input.penaltyReason,
        compensationAmount: input.compensationAmount,
        compensationReason: input.compensationReason,
        receivableAmount: amounts.receivableAmount,
        refundableAmount: amounts.refundableAmount,
        netAmount: amounts.netAmount,
        status,
      },
    });

    // 更新押金记录
    if (lease.deposit) {
      const newRefunded = new Prisma.Decimal(lease.deposit.refundedAmount).plus(
        amounts.depositRefundAmount
      );
      let depositStatus: DepositStatus = 'PAID';
      if (
        newRefunded.greaterThan(0) &&
        newRefunded.lessThan(lease.deposit.paidAmount)
      ) {
        depositStatus = 'PARTIAL_REFUNDED';
      } else if (newRefunded.greaterThanOrEqualTo(lease.deposit.paidAmount)) {
        depositStatus = 'FULLY_REFUNDED';
      }

      await tx.deposit.update({
        where: { id: lease.deposit.id },
        data: {
          refundedAmount: newRefunded,
          status: depositStatus,
        },
      });
    }

    await tx.meterReading.createMany({
      data: [
        {
          organizationId,
          apartmentId: lease.room.apartmentId,
          roomId: lease.roomId,
          leaseId: lease.id,
          meterType: 'WATER',
          readingDate: input.terminatedAt,
          value: input.currentWater,
          source: 'MANUAL',
          status: 'NORMAL',
          note: '退租结算读数',
          createdById: userId,
        },
        {
          organizationId,
          apartmentId: lease.room.apartmentId,
          roomId: lease.roomId,
          leaseId: lease.id,
          meterType: 'POWER',
          readingDate: input.terminatedAt,
          value: input.currentPower,
          source: 'MANUAL',
          status: 'NORMAL',
          note: '退租结算读数',
          createdById: userId,
        },
      ],
    });

    // 结清该租约下所有未结清账单
    const pendingBills = await tx.bill.findMany({
      where: { leaseId: lease.id, status: { notIn: ['PAID', 'VOID'] } },
      include: { items: true },
    });
    for (const bill of pendingBills) {
      const remaining = new Prisma.Decimal(bill.totalAmount).minus(
        bill.paidAmount
      );
      if (remaining.greaterThan(0)) {
        const payment = await tx.payment.create({
          data: {
            billId: bill.id,
            userId,
            amount: remaining,
            method: '退租自动结清',
            note: '退租结算时自动结清未收账单',
            status: 'COMPLETED',
          },
        });

        // 创建收支记录（按账单明细项拆分）
        const billTotal = new Prisma.Decimal(bill.totalAmount);
        for (const item of bill.items) {
          const itemAmount = new Prisma.Decimal(item.amount);
          if (itemAmount.lessThanOrEqualTo(0)) continue;

          const splitAmount = itemAmount
            .div(billTotal)
            .mul(remaining)
            .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

          if (splitAmount.lessThanOrEqualTo(0)) continue;

          const category = getCategoryFromBillItemType(item.type);
          await tx.transaction.create({
            data: {
              organizationId,
              type: 'INCOME',
              category,
              amount: splitAmount,
              method: '退租自动结清',
              description: `${lease.room.apartment.name} - ${lease.room.roomNo} ${item.name}（退租自动结清）`,
              note: '退租结算时自动结清未收账单',
              operatorId: userId,
              sourceType: 'BILL_PAYMENT',
              sourceId: payment.id,
              billId: bill.id,
              leaseId: lease.id,
              apartmentId: lease.room.apartmentId,
            },
          });
        }
      }
      await tx.bill.update({
        where: { id: bill.id },
        data: { status: 'PAID', paidAmount: bill.totalAmount },
      });
    }

    await tx.lease.update({
      where: { id: lease.id },
      data: {
        status: 'TERMINATED',
        terminationType: input.type,
        terminationReason: input.reason,
        terminatedAt: input.terminatedAt,
      },
    });
    await tx.room.update({
      where: { id: lease.roomId },
      data: { status: 'VACANT' },
    });

    return { settlement, settlementBill };
  });
};

/**
 * 记录退租结算的收款或退款
 * @param settlementId - 退租结算单 ID
 * @param organizationId - 组织 ID
 * @param userId - 操作用户 ID
 * @param direction - 收退款方向（RECEIVE 收款 / REFUND 退款）
 * @param amount - 收/退款金额
 * @param method - 收/退款方式
 * @param note - 备注
 * @returns 创建的 settlementPayment 记录
 */
export const recordSettlementPayment = async ({
  settlementId,
  organizationId,
  userId,
  direction,
  amount,
  method,
  note,
}: {
  settlementId: string;
  organizationId: string;
  userId: string;
  direction: 'RECEIVE' | 'REFUND';
  amount: DecimalValue;
  method: string;
  note?: string;
}) => {
  const settlement = await prisma.leaseSettlement.findFirst({
    where: { id: settlementId, organizationId },
    include: {
      payments: true,
      bill: true,
      lease: { include: { room: { include: { apartment: true } } } },
    },
  });
  if (!settlement) throw new HttpError(404, '退租结算单不存在');
  const expectedDirection = getSettlementDirection(settlement.netAmount);
  if (expectedDirection === 'NONE') throw new HttpError(400, '该结算单已结清');
  if (direction !== expectedDirection)
    throw new HttpError(
      400,
      direction === 'RECEIVE' ? '该结算单应登记退款' : '该结算单应登记收款'
    );

  const targetAmount = new Prisma.Decimal(settlement.netAmount).abs();
  const handledAmount = settlement.payments.reduce(
    (sum, payment) => sum.plus(payment.amount),
    new Prisma.Decimal(0)
  );
  const paymentAmount = new Prisma.Decimal(amount);
  if (paymentAmount.greaterThan(targetAmount.minus(handledAmount)))
    throw new HttpError(400, '金额不能超过剩余待处理金额');

  // 创建 SettlementPayment（保留历史记录）
  const settlementPayment = await prisma.settlementPayment.create({
    data: { settlementId, userId, direction, amount, method, note },
  });

  // 同步到退租结算账单的 Payment
  if (settlement.bill) {
    const paymentType = direction === 'RECEIVE' ? 'RECEIVE' : 'REFUND';
    await prisma.payment.create({
      data: {
        billId: settlement.bill.id,
        userId,
        type: paymentType,
        amount: paymentAmount,
        method,
        note: note || `退租结算${direction === 'RECEIVE' ? '收款' : '退款'}`,
        status: 'COMPLETED',
      },
    });

    // 手动更新退租结算账单状态
    const newPaidAmount = new Prisma.Decimal(settlement.bill.paidAmount).plus(
      paymentAmount
    );
    const isPaid = newPaidAmount.greaterThanOrEqualTo(
      settlement.bill.totalAmount
    );
    await prisma.bill.update({
      where: { id: settlement.bill.id },
      data: {
        paidAmount: newPaidAmount,
        status: isPaid ? 'PAID' : 'PARTIAL_PAID',
      },
    });
  }

  // 创建收支记录（按退租结算账单明细项拆分）
  if (settlement.bill) {
    const billWithItems = await prisma.bill.findUnique({
      where: { id: settlement.bill.id },
      include: { items: true },
    });

    if (
      billWithItems &&
      billWithItems.items.length > 0 &&
      new Prisma.Decimal(billWithItems.totalAmount).greaterThan(0)
    ) {
      const billTotal = new Prisma.Decimal(billWithItems.totalAmount);
      const apartmentName = settlement.lease.room.apartment.name;
      const roomNo = settlement.lease.room.roomNo;

      for (const item of billWithItems.items) {
        const itemAmount = new Prisma.Decimal(item.amount);
        if (itemAmount.lessThanOrEqualTo(0)) continue;

        // 按金额比例拆分
        const splitAmount = itemAmount
          .div(billTotal)
          .mul(paymentAmount)
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

        if (splitAmount.lessThanOrEqualTo(0)) continue;

        // 根据明细项名称判断收入/支出和科目
        let transType: 'INCOME' | 'EXPENSE';
        let category: string;

        if (item.name.includes('退款')) {
          transType = 'EXPENSE';
          if (item.type === 'DEPOSIT') {
            category = 'DEPOSIT_REFUND';
          } else if (item.type === 'RENT') {
            category = 'BILL_REFUND';
          } else {
            category = 'OTHER_EXPENSE';
          }
        } else {
          transType = 'INCOME';
          category = getCategoryFromBillItemType(item.type);
        }

        await createTransaction({
          organizationId,
          type: transType,
          category: category as any,
          amount: splitAmount,
          method,
          description: `${apartmentName} - ${roomNo} ${item.name}`,
          note: note || `退租结算${direction === 'RECEIVE' ? '收款' : '退款'}`,
          operatorId: userId,
          sourceType: 'SETTLEMENT_PAYMENT',
          sourceId: settlementPayment.id,
          billId: settlement.billId || undefined,
          leaseId: settlement.leaseId,
          apartmentId: settlement.lease.room.apartmentId,
        });
      }
    }
  }

  const nextHandledAmount = handledAmount.plus(paymentAmount);
  if (nextHandledAmount.greaterThanOrEqualTo(targetAmount)) {
    await prisma.leaseSettlement.update({
      where: { id: settlementId },
      data: { status: 'SETTLED' },
    });
  }
  return settlementPayment;
};
