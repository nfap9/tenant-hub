import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from '../middleware/auth.js';
import { PERMISSIONS } from '../services/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, ok } from '../utils/http.js';

export const landlordPaymentRouter = Router();
landlordPaymentRouter.use(requireAuth, requireOrg);

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function diffInMonths(start: Date, end: Date): number {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  );
}

function getIntervalMonths(method: string): number {
  switch (method) {
    case 'MONTHLY':
      return 1;
    case 'QUARTERLY':
      return 3;
    case 'HALF_YEARLY':
      return 6;
    case 'YEARLY':
      return 12;
    default:
      return 1;
  }
}

landlordPaymentRouter.get(
  '/',
  requirePermission(PERMISSIONS.APARTMENT_VIEW),
  asyncHandler(async (req, res) => {
    const contractId = z.string().optional().parse(req.query.contractId);
    const apartmentId = z.string().optional().parse(req.query.apartmentId);
    const status = z
      .enum(['PENDING', 'PAID', 'OVERDUE'])
      .optional()
      .parse(req.query.status);

    const payments = await prisma.landlordPayment.findMany({
      where: {
        organizationId: req.organizationId!,
        ...(contractId ? { landlordContractId: contractId } : {}),
        ...(apartmentId ? { apartmentId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        landlordContract: { select: { id: true, contractNo: true } },
        apartment: { select: { id: true, name: true } },
        expense: { select: { id: true, name: true, amount: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
    ok(res, payments);
  })
);

landlordPaymentRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.APARTMENT_VIEW),
  asyncHandler(async (req, res) => {
    const payment = await prisma.landlordPayment.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organizationId!,
      },
      include: {
        landlordContract: true,
        apartment: { select: { id: true, name: true } },
        expense: true,
      },
    });
    if (!payment) throw new HttpError(404, '付款计划不存在');
    ok(res, payment);
  })
);

landlordPaymentRouter.post(
  '/generate',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const { landlordContractId } = z
      .object({ landlordContractId: z.string() })
      .parse(req.body);

    const contract = await prisma.landlordContract.findFirst({
      where: {
        id: landlordContractId,
        apartment: { organizationId: req.organizationId! },
        deletedAt: null,
      },
    });
    if (!contract) throw new HttpError(404, '合同不存在');

    // 删除该合同下所有未付款的计划，重新生成
    await prisma.landlordPayment.deleteMany({
      where: {
        landlordContractId,
        organizationId: req.organizationId!,
        status: 'PENDING',
      },
    });

    const intervalMonths = getIntervalMonths(contract.paymentMethod);
    const startDate = new Date(contract.startDate);
    const endDate = new Date(contract.endDate);
    const payments = [];

    let currentDate = new Date(startDate);
    let periodIndex = 0;
    let currentRent = Number(contract.rentAmount);

    while (currentDate < endDate) {
      const periodStart = new Date(currentDate);
      let periodEnd = addMonths(currentDate, intervalMonths);
      if (periodEnd > endDate) {
        periodEnd = new Date(endDate);
      }

      // 计算应付金额
      let plannedAmount = currentRent * intervalMonths;
      const actualMonths = diffInMonths(periodStart, periodEnd);
      if (actualMonths !== intervalMonths) {
        plannedAmount = currentRent * actualMonths;
      }

      // 免租期处理
      if (
        contract.freeRentDays > 0 &&
        contract.freeRentStart &&
        contract.freeRentEnd
      ) {
        const frStart = new Date(contract.freeRentStart);
        const frEnd = new Date(contract.freeRentEnd);
        if (periodStart >= frStart && periodEnd <= frEnd) {
          plannedAmount = 0;
        } else if (periodStart < frEnd && periodEnd > frStart) {
          // 部分重叠：简化处理，按天数比例扣减
          const overlapStart = periodStart > frStart ? periodStart : frStart;
          const overlapEnd = periodEnd < frEnd ? periodEnd : frEnd;
          const overlapDays =
            (overlapEnd.getTime() - overlapStart.getTime()) /
            (1000 * 60 * 60 * 24);
          const periodDays =
            (periodEnd.getTime() - periodStart.getTime()) /
            (1000 * 60 * 60 * 24);
          if (periodDays > 0) {
            plannedAmount = plannedAmount * (1 - overlapDays / periodDays);
          }
        }
      }

      // 递增处理
      if (
        periodIndex > 0 &&
        contract.escalationType &&
        contract.escalationValue &&
        contract.escalationCycle &&
        contract.escalationCycle > 0
      ) {
        const monthsElapsed = diffInMonths(startDate, periodStart);
        if (
          monthsElapsed > 0 &&
          monthsElapsed % contract.escalationCycle === 0
        ) {
          if (contract.escalationType === 'FIXED_AMOUNT') {
            currentRent += Number(contract.escalationValue);
          } else if (contract.escalationType === 'PERCENTAGE') {
            currentRent *= 1 + Number(contract.escalationValue) / 100;
          }
          // 重新计算 plannedAmount
          plannedAmount = currentRent * actualMonths;
        }
      }

      payments.push({
        organizationId: req.organizationId!,
        landlordContractId: contract.id,
        apartmentId: contract.apartmentId,
        periodStart,
        periodEnd,
        dueDate: periodStart,
        plannedAmount: Math.round(plannedAmount * 100) / 100,
        status: 'PENDING',
      });

      currentDate = periodEnd;
      periodIndex++;
    }

    const created = await prisma.landlordPayment.createMany({
      data: payments,
    });

    ok(res, { generated: created.count });
  })
);

landlordPaymentRouter.post(
  '/:id/pay',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        paidAmount: z.coerce.number().positive(),
        paidAt: z.coerce.date(),
        voucherNo: z.string().optional(),
        paymentMethod: z.string().optional(),
        note: z.string().optional(),
        createExpense: z.boolean().optional(),
      })
      .parse(req.body);

    const payment = await prisma.landlordPayment.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organizationId!,
      },
      include: { apartment: true },
    });
    if (!payment) throw new HttpError(404, '付款计划不存在');

    let expenseId: string | undefined;

    if (input.createExpense) {
      const expense = await prisma.apartmentExpense.create({
        data: {
          apartmentId: payment.apartmentId,
          name: `房东租金付款 - ${payment.landlordContractId.slice(0, 8)}`,
          amount: input.paidAmount,
          spentAt: input.paidAt,
          note: input.note || input.voucherNo,
          createdById: req.user!.id,
        },
      });
      expenseId = expense.id;
    }

    const updated = await prisma.landlordPayment.update({
      where: { id: req.params.id },
      data: {
        paidAmount: input.paidAmount,
        paidAt: input.paidAt,
        voucherNo: input.voucherNo,
        paymentMethod: input.paymentMethod,
        status: 'PAID',
        note: input.note,
        ...(expenseId ? { expenseId } : {}),
      },
      include: {
        landlordContract: { select: { id: true, contractNo: true } },
        apartment: { select: { id: true, name: true } },
        expense: true,
      },
    });

    ok(res, updated);
  })
);

landlordPaymentRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const payment = await prisma.landlordPayment.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organizationId!,
      },
    });
    if (!payment) throw new HttpError(404, '付款计划不存在');
    if (payment.status === 'PAID') {
      throw new HttpError(400, '已付款的计划不能删除');
    }

    await prisma.landlordPayment.delete({ where: { id: req.params.id } });
    ok(res, { deleted: true });
  })
);
