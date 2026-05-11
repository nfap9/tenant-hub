import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/http.js";
import { calculateUtilityAmount } from "./billing.js";

type DecimalValue = Prisma.Decimal.Value;

type SettlementCalculationInput = {
  depositAmount: DecimalValue;
  depositDeductionAmount: DecimalValue;
  rentAdjustmentAmount: DecimalValue;
  previousWater: DecimalValue;
  currentWater: DecimalValue;
  waterUnitPrice: DecimalValue;
  previousPower: DecimalValue;
  currentPower: DecimalValue;
  powerUnitPrice: DecimalValue;
  otherFeeAmount: DecimalValue;
};

export const validateMoveOutReadings = ({
  previousWater,
  currentWater,
  previousPower,
  currentPower
}: Pick<SettlementCalculationInput, "previousWater" | "currentWater" | "previousPower" | "currentPower">) => {
  if (new Prisma.Decimal(currentWater).lessThan(previousWater)) throw new Error("退租水表读数不能小于上次读数");
  if (new Prisma.Decimal(currentPower).lessThan(previousPower)) throw new Error("退租电表读数不能小于上次读数");
};

export const calculateSettlementAmounts = (input: SettlementCalculationInput) => {
  validateMoveOutReadings(input);

  const depositAmount = new Prisma.Decimal(input.depositAmount);
  const depositDeductionAmount = new Prisma.Decimal(input.depositDeductionAmount);
  if (depositDeductionAmount.greaterThan(depositAmount)) throw new Error("押金扣款不能超过原押金");

  const rentAdjustmentAmount = new Prisma.Decimal(input.rentAdjustmentAmount);
  const utilityAmount = calculateUtilityAmount(input);
  const otherFeeAmount = new Prisma.Decimal(input.otherFeeAmount);
  const depositRefundAmount = depositAmount.minus(depositDeductionAmount);
  const rentReceivable = rentAdjustmentAmount.greaterThan(0) ? rentAdjustmentAmount : new Prisma.Decimal(0);
  const rentRefund = rentAdjustmentAmount.lessThan(0) ? rentAdjustmentAmount.abs() : new Prisma.Decimal(0);
  const receivableAmount = rentReceivable.plus(utilityAmount).plus(otherFeeAmount).plus(depositDeductionAmount);
  const refundableAmount = depositRefundAmount.plus(rentRefund);
  const netAmount = receivableAmount.minus(refundableAmount);

  return { utilityAmount, depositRefundAmount, receivableAmount, refundableAmount, netAmount };
};

export const getSettlementDirection = (netAmount: DecimalValue) => {
  const net = new Prisma.Decimal(netAmount);
  if (net.greaterThan(0)) return "RECEIVE" as const;
  if (net.lessThan(0)) return "REFUND" as const;
  return "NONE" as const;
};

const latestReadingValue = async (organizationId: string, roomId: string, meterType: "WATER" | "POWER", date: Date) => {
  const reading = await prisma.meterReading.findFirst({
    where: { organizationId, roomId, meterType, readingDate: { lte: date }, status: { not: "VOID" } },
    orderBy: { readingDate: "desc" }
  });
  return reading?.value ?? new Prisma.Decimal(0);
};

export const getLeaseSettlementPreview = async ({
  leaseId,
  organizationId,
  terminatedAt
}: {
  leaseId: string;
  organizationId: string;
  terminatedAt: Date;
}) => {
  const lease = await prisma.lease.findFirst({ where: { id: leaseId, organizationId } });
  if (!lease) throw new HttpError(404, "租约不存在");
  const [previousWater, previousPower] = await Promise.all([
    latestReadingValue(organizationId, lease.roomId, "WATER", terminatedAt),
    latestReadingValue(organizationId, lease.roomId, "POWER", terminatedAt)
  ]);
  return { previousWater, previousPower };
};

export const createLeaseSettlement = async ({
  leaseId,
  organizationId,
  userId,
  input
}: {
  leaseId: string;
  organizationId: string;
  userId: string;
  input: {
    type: "EXPIRED" | "NEGOTIATED" | "BREACH";
    reason?: string;
    terminatedAt: Date;
    depositDeductionAmount: DecimalValue;
    depositDeductionReason?: string;
    rentAdjustmentAmount: DecimalValue;
    currentWater: DecimalValue;
    currentPower: DecimalValue;
    otherFeeAmount: DecimalValue;
    otherFeeReason?: string;
  };
}) => {
  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, organizationId },
    include: { room: true }
  });
  if (!lease) throw new HttpError(404, "租约不存在");
  if (lease.status !== "ACTIVE") throw new HttpError(400, "仅有效租约可以退租结算");

  const existing = await prisma.leaseSettlement.findUnique({ where: { leaseId } });
  if (existing) throw new HttpError(409, "该租约已有退租结算单");

  const [previousWater, previousPower] = await Promise.all([
    latestReadingValue(organizationId, lease.roomId, "WATER", input.terminatedAt),
    latestReadingValue(organizationId, lease.roomId, "POWER", input.terminatedAt)
  ]);

  let amounts;
  try {
    amounts = calculateSettlementAmounts({
      depositAmount: lease.depositAmount,
      depositDeductionAmount: input.depositDeductionAmount,
      rentAdjustmentAmount: input.rentAdjustmentAmount,
      previousWater,
      currentWater: input.currentWater,
      waterUnitPrice: lease.waterUnitPrice,
      previousPower,
      currentPower: input.currentPower,
      powerUnitPrice: lease.powerUnitPrice,
      otherFeeAmount: input.otherFeeAmount
    });
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "退租结算失败");
  }

  const status = amounts.netAmount.equals(0) ? "SETTLED" : "PENDING";

  return prisma.$transaction(async (tx) => {
    const settlement = await tx.leaseSettlement.create({
      data: {
        organizationId,
        leaseId: lease.id,
        roomId: lease.roomId,
        type: input.type,
        reason: input.reason,
        terminatedAt: input.terminatedAt,
        depositAmount: lease.depositAmount,
        depositDeductionAmount: input.depositDeductionAmount,
        depositDeductionReason: input.depositDeductionReason,
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
        receivableAmount: amounts.receivableAmount,
        refundableAmount: amounts.refundableAmount,
        netAmount: amounts.netAmount,
        status
      }
    });

    await tx.meterReading.createMany({
      data: [
        {
          organizationId,
          apartmentId: lease.room.apartmentId,
          roomId: lease.roomId,
          leaseId: lease.id,
          meterType: "WATER",
          readingDate: input.terminatedAt,
          value: input.currentWater,
          source: "MANUAL",
          status: "NORMAL",
          note: "退租结算读数",
          createdById: userId
        },
        {
          organizationId,
          apartmentId: lease.room.apartmentId,
          roomId: lease.roomId,
          leaseId: lease.id,
          meterType: "POWER",
          readingDate: input.terminatedAt,
          value: input.currentPower,
          source: "MANUAL",
          status: "NORMAL",
          note: "退租结算读数",
          createdById: userId
        }
      ]
    });

    // 结清该租约下所有未结清账单
    const pendingMonthlyBills = await tx.monthlyBill.findMany({
      where: { leaseId: lease.id, status: { notIn: ["PAID", "VOID"] } }
    });
    for (const monthlyBill of pendingMonthlyBills) {
      const remaining = new Prisma.Decimal(monthlyBill.totalAmount).minus(monthlyBill.paidAmount);
      if (remaining.greaterThan(0)) {
        await tx.payment.create({
          data: {
            monthlyBillId: monthlyBill.id,
            userId,
            amount: remaining,
            method: "退租自动结清",
            note: "退租结算时自动结清未收账单"
          }
        });
      }
      await tx.monthlyBill.update({ where: { id: monthlyBill.id }, data: { status: "PAID", paidAmount: monthlyBill.totalAmount } });
    }

    await tx.lease.update({
      where: { id: lease.id },
      data: { status: "TERMINATED", terminationType: input.type, terminationReason: input.reason, terminatedAt: input.terminatedAt }
    });
    await tx.room.update({ where: { id: lease.roomId }, data: { status: "VACANT" } });

    return settlement;
  });
};

export const recordSettlementPayment = async ({
  settlementId,
  organizationId,
  userId,
  direction,
  amount,
  method,
  note
}: {
  settlementId: string;
  organizationId: string;
  userId: string;
  direction: "RECEIVE" | "REFUND";
  amount: DecimalValue;
  method: string;
  note?: string;
}) => {
  const settlement = await prisma.leaseSettlement.findFirst({ where: { id: settlementId, organizationId }, include: { payments: true } });
  if (!settlement) throw new HttpError(404, "退租结算单不存在");
  const expectedDirection = getSettlementDirection(settlement.netAmount);
  if (expectedDirection === "NONE") throw new HttpError(400, "该结算单已结清");
  if (direction !== expectedDirection) throw new HttpError(400, direction === "RECEIVE" ? "该结算单应登记退款" : "该结算单应登记收款");

  const targetAmount = new Prisma.Decimal(settlement.netAmount).abs();
  const handledAmount = settlement.payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
  const paymentAmount = new Prisma.Decimal(amount);
  if (paymentAmount.greaterThan(targetAmount.minus(handledAmount))) throw new HttpError(400, "金额不能超过剩余待处理金额");

  const payment = await prisma.settlementPayment.create({ data: { settlementId, userId, direction, amount, method, note } });
  const nextHandledAmount = handledAmount.plus(paymentAmount);
  if (nextHandledAmount.greaterThanOrEqualTo(targetAmount)) {
    await prisma.leaseSettlement.update({ where: { id: settlementId }, data: { status: "SETTLED" } });
  }
  return payment;
};
