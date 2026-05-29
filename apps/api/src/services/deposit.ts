import { Prisma, DepositStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { HttpError } from '../utils/http.js';

type DecimalValue = Prisma.Decimal.Value;

export const refreshDepositStatus = async (depositId: string) => {
  const deposit = await prisma.deposit.findUnique({
    where: { id: depositId },
  });
  if (!deposit) return;

  const paid = deposit.paidAmount;
  const refunded = deposit.refundedAmount;
  const deducted = deposit.deductedAmount;

  let status: DepositStatus;
  if (paid.equals(0)) {
    status = 'UNPAID';
  } else if (refunded.greaterThan(0) && refunded.lessThan(paid)) {
    status = 'PARTIAL_REFUNDED';
  } else if (refunded.equals(paid) || deducted.plus(refunded).equals(paid)) {
    status = refunded.greaterThan(0) ? 'FULLY_REFUNDED' : 'DEDUCTED';
  } else {
    status = 'PAID';
  }

  await prisma.deposit.update({
    where: { id: depositId },
    data: { status },
  });
};

export const recordDepositPayment = async ({
  depositId,
  userId,
  type,
  amount,
  method,
  note,
}: {
  depositId: string;
  userId: string;
  type: 'COLLECT' | 'REFUND' | 'DEDUCT';
  amount: DecimalValue;
  method: string;
  note?: string;
}) => {
  const deposit = await prisma.deposit.findUnique({
    where: { id: depositId },
  });
  if (!deposit) throw new HttpError(404, '押金记录不存在');
  if (!deposit.billId) throw new HttpError(400, '押金账单不存在');

  const paymentAmount = new Prisma.Decimal(amount);
  if (paymentAmount.lessThanOrEqualTo(0))
    throw new HttpError(400, '金额必须大于 0');

  const paid = deposit.paidAmount;
  const refunded = deposit.refundedAmount;
  const deducted = deposit.deductedAmount;

  if (type === 'COLLECT') {
    const remaining = new Prisma.Decimal(deposit.amount).minus(paid);
    if (paymentAmount.greaterThan(remaining))
      throw new HttpError(
        400,
        `收款金额不能超过剩余应收 ¥${remaining.toFixed(2)}`
      );
  } else if (type === 'REFUND') {
    const refundable = paid.minus(refunded).minus(deducted);
    if (paymentAmount.greaterThan(refundable))
      throw new HttpError(
        400,
        `退款金额不能超过可退余额 ¥${refundable.toFixed(2)}`
      );
  } else if (type === 'DEDUCT') {
    const deductible = paid.minus(deducted).minus(refunded);
    if (paymentAmount.greaterThan(deductible))
      throw new HttpError(
        400,
        `扣款金额不能超过已收押金余额 ¥${deductible.toFixed(2)}`
      );
  }

  const paymentType = type === 'COLLECT' ? 'RECEIVE' : type;
  const payment = await prisma.payment.create({
    data: {
      billId: deposit.billId,
      userId,
      type: paymentType as 'RECEIVE' | 'REFUND' | 'DEDUCT',
      amount: paymentAmount,
      method,
      note,
      status: 'COMPLETED',
    },
  });

  await prisma.deposit.update({
    where: { id: depositId },
    data: {
      paidAmount: type === 'COLLECT' ? paid.plus(paymentAmount) : paid,
      refundedAmount:
        type === 'REFUND' ? refunded.plus(paymentAmount) : refunded,
      deductedAmount:
        type === 'DEDUCT' ? deducted.plus(paymentAmount) : deducted,
    },
  });

  await refreshDepositStatus(depositId);
  return payment;
};

export const getDepositSummary = async (organizationId: string) => {
  const deposits = await prisma.deposit.findMany({
    where: { organizationId },
    include: { lease: true },
  });

  const totalAmount = deposits.reduce(
    (sum, d) => sum.plus(d.amount),
    new Prisma.Decimal(0)
  );
  const paidAmount = deposits.reduce(
    (sum, d) => sum.plus(d.paidAmount),
    new Prisma.Decimal(0)
  );
  const refundedAmount = deposits.reduce(
    (sum, d) => sum.plus(d.refundedAmount),
    new Prisma.Decimal(0)
  );
  const deductedAmount = deposits.reduce(
    (sum, d) => sum.plus(d.deductedAmount),
    new Prisma.Decimal(0)
  );
  const heldAmount = paidAmount.minus(refundedAmount).minus(deductedAmount);

  // 待退总额：已退租（TERMINATED）但押金未全额退还
  const pendingRefundAmount = deposits
    .filter(
      (d) =>
        d.lease?.status === 'TERMINATED' &&
        d.status !== 'FULLY_REFUNDED' &&
        d.status !== 'DEDUCTED'
    )
    .reduce(
      (sum, d) =>
        sum.plus(d.paidAmount).minus(d.refundedAmount).minus(d.deductedAmount),
      new Prisma.Decimal(0)
    );

  return {
    totalAmount,
    paidAmount,
    refundedAmount,
    deductedAmount,
    heldAmount,
    pendingRefundAmount,
    count: deposits.length,
  };
};
