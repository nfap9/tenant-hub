import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';

/**
 * US-702: 账单逾期自动标记
 * 扫描所有状态为 UNPAID / PARTIAL_PAID 且已超过宽限期的账单，标记为 OVERDUE
 */
export const markOverdueBills = async () => {
  const now = new Date();
  const overdueBills = await prisma.bill.findMany({
    where: {
      status: { in: ['UNPAID', 'PARTIAL_PAID'] },
      type: { not: 'SETTLEMENT' },
      deletedAt: null,
    },
    include: { lease: true },
  });

  let markedCount = 0;
  for (const bill of overdueBills) {
    const graceDays = bill.lease.graceDays ?? 0;
    const deadline = new Date(bill.dueDate);
    deadline.setDate(deadline.getDate() + graceDays);

    if (now > deadline) {
      await prisma.bill.update({
        where: { id: bill.id },
        data: { status: 'OVERDUE' },
      });
      markedCount++;
    }
  }

  return markedCount;
};

/**
 * US-704: 滞纳金自动计算
 * 对 OVERDUE 状态账单计算滞纳金，生成 LATE_FEE 子项
 */
export const calculateOverduePenalties = async () => {
  const now = new Date();
  const overdueBills = await prisma.bill.findMany({
    where: {
      status: { in: ['OVERDUE', 'PARTIAL_PAID'] },
      type: { not: 'SETTLEMENT' },
      deletedAt: null,
    },
    include: { lease: true, items: true, overduePenalties: true },
  });

  let calculatedCount = 0;
  for (const bill of overdueBills) {
    const lease = bill.lease;
    const graceDays = lease.graceDays ?? 0;
    const lateFeeRate = Number(lease.lateFeeRate);
    if (lateFeeRate <= 0) continue;

    const deadline = new Date(bill.dueDate);
    deadline.setDate(deadline.getDate() + graceDays);
    if (now <= deadline) continue;

    const daysOverdue = Math.floor(
      (now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysOverdue <= 0) continue;

    const unpaidAmount = new Prisma.Decimal(bill.totalAmount).minus(
      bill.paidAmount
    );
    if (unpaidAmount.lessThanOrEqualTo(0)) continue;

    const penaltyAmount = unpaidAmount
      .times(lateFeeRate)
      .times(daysOverdue)
      .toDecimalPlaces(2);

    // 检查今天是否已经计算过滞纳金
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const alreadyCalculatedToday = bill.overduePenalties.some(
      (p) => p.calculatedAt >= todayStart && p.calculatedAt < todayEnd
    );
    if (alreadyCalculatedToday) continue;

    await prisma.$transaction(async (tx) => {
      // 创建滞纳金记录
      await tx.overduePenalty.create({
        data: {
          billId: bill.id,
          leaseId: lease.id,
          amount: penaltyAmount,
          baseAmount: unpaidAmount,
          daysOverdue,
          rate: new Prisma.Decimal(lateFeeRate),
        },
      });

      // 查找是否已有 LATE_FEE 子项
      const existingLateFee = bill.items.find((i) => i.type === 'LATE_FEE');
      if (existingLateFee) {
        // 累加滞纳金
        await tx.billItem.update({
          where: { id: existingLateFee.id },
          data: {
            amount: new Prisma.Decimal(existingLateFee.amount).plus(
              penaltyAmount
            ),
          },
        });
      } else {
        // 创建新的 LATE_FEE 子项
        await tx.billItem.create({
          data: {
            billId: bill.id,
            type: 'LATE_FEE',
            name: '滞纳金',
            amount: penaltyAmount,
          },
        });
      }
    });

    calculatedCount++;
  }

  return calculatedCount;
};
