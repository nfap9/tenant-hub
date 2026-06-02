import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma/client.js';
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from '../middleware/auth.js';
import { PERMISSIONS } from '../services/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, ok } from '../utils/http.js';

export const landlordContractRouter = Router();
landlordContractRouter.use(requireAuth, requireOrg);

const contractInput = z.object({
  apartmentId: z.string(),
  contractNo: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  rentAmount: z.coerce.number().nonnegative(),
  depositAmount: z.coerce.number().nonnegative().default(0),
  paymentMethod: z.string(),
  escalationType: z.string().optional(),
  escalationValue: z.coerce.number().optional(),
  escalationCycle: z.coerce.number().int().optional(),
  freeRentDays: z.coerce.number().int().min(0).default(0),
  freeRentStart: z.coerce.date().optional(),
  freeRentEnd: z.coerce.date().optional(),
  signDate: z.coerce.date().optional(),
  attachmentUrl: z.string().optional(),
  note: z.string().optional(),
});

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

landlordContractRouter.get(
  '/',
  requirePermission(PERMISSIONS.APARTMENT_VIEW),
  asyncHandler(async (req, res) => {
    const apartmentId = z.string().optional().parse(req.query.apartmentId);
    const contracts = await prisma.landlordContract.findMany({
      where: {
        apartment: { organizationId: req.organizationId! },
        deletedAt: null,
        ...(apartmentId ? { apartmentId } : {}),
      },
      include: { apartment: true, payments: { orderBy: { dueDate: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, contracts);
  })
);

landlordContractRouter.post(
  '/',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = contractInput.parse(req.body);
    const apartment = await prisma.apartment.findFirst({
      where: { id: input.apartmentId, organizationId: req.organizationId! },
    });
    if (!apartment) throw new HttpError(404, '公寓不存在');
    ok(
      res,
      await prisma.landlordContract.create({
        data: input,
        include: { apartment: true },
      })
    );
  })
);

landlordContractRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.APARTMENT_VIEW),
  asyncHandler(async (req, res) => {
    const contract = await prisma.landlordContract.findFirst({
      where: {
        id: req.params.id,
        apartment: { organizationId: req.organizationId! },
        deletedAt: null,
      },
      include: { apartment: true, payments: { orderBy: { dueDate: 'asc' } } },
    });
    if (!contract) throw new HttpError(404, '合同不存在');
    ok(res, contract);
  })
);

landlordContractRouter.put(
  '/:id',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = contractInput.partial().parse(req.body);
    const contract = await prisma.landlordContract.findFirst({
      where: {
        id: req.params.id,
        apartment: { organizationId: req.organizationId! },
        deletedAt: null,
      },
    });
    if (!contract) throw new HttpError(404, '合同不存在');
    ok(
      res,
      await prisma.landlordContract.update({
        where: { id: req.params.id },
        data: input,
        include: { apartment: true },
      })
    );
  })
);

landlordContractRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const contract = await prisma.landlordContract.findFirst({
      where: {
        id: req.params.id,
        apartment: { organizationId: req.organizationId! },
        deletedAt: null,
      },
    });
    if (!contract) throw new HttpError(404, '合同不存在');
    await prisma.landlordContract.softDelete({ where: { id: req.params.id } });
    ok(res, { deleted: true });
  })
);

// Payment Plan Generation
landlordContractRouter.post(
  '/:id/payment-plan/generate',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const contract = await prisma.landlordContract.findFirst({
      where: {
        id: req.params.id,
        apartment: { organizationId: req.organizationId! },
        deletedAt: null,
      },
    });
    if (!contract) throw new HttpError(404, '合同不存在');

    // Delete pending payments for this contract
    await prisma.landlordPayment.deleteMany({
      where: {
        landlordContractId: contract.id,
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

      let plannedAmount = currentRent * intervalMonths;
      const actualMonths = diffInMonths(periodStart, periodEnd);
      if (actualMonths !== intervalMonths) {
        plannedAmount = currentRent * actualMonths;
      }

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

    const created = await prisma.landlordPayment.createMany({ data: payments });
    ok(res, { generated: created.count });
  })
);

landlordContractRouter.get(
  '/:id/payment-plan',
  requirePermission(PERMISSIONS.APARTMENT_VIEW),
  asyncHandler(async (req, res) => {
    const payments = await prisma.landlordPayment.findMany({
      where: {
        landlordContractId: req.params.id,
        organizationId: req.organizationId!,
      },
      include: { expense: { select: { id: true, name: true, amount: true } } },
      orderBy: { dueDate: 'asc' },
    });
    ok(res, payments);
  })
);

// Record actual payment
landlordContractRouter.post(
  '/:id/payments',
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

    const contract = await prisma.landlordContract.findFirst({
      where: {
        id: req.params.id,
        apartment: { organizationId: req.organizationId! },
        deletedAt: null,
      },
    });
    if (!contract) throw new HttpError(404, '合同不存在');

    let expenseId: string | undefined;
    if (input.createExpense) {
      const expense = await prisma.apartmentExpense.create({
        data: {
          apartmentId: contract.apartmentId,
          name: `房东租金付款 - ${contract.contractNo || contract.id.slice(0, 8)}`,
          amount: input.paidAmount,
          spentAt: input.paidAt,
          note: input.note || input.voucherNo,
          createdById: req.user!.id,
        },
      });
      expenseId = expense.id;
    }

    const payment = await prisma.landlordPayment.create({
      data: {
        organizationId: req.organizationId!,
        landlordContractId: contract.id,
        apartmentId: contract.apartmentId,
        periodStart: contract.startDate,
        periodEnd: contract.endDate,
        dueDate: input.paidAt,
        plannedAmount: input.paidAmount,
        paidAmount: input.paidAmount,
        paidAt: input.paidAt,
        voucherNo: input.voucherNo,
        paymentMethod: input.paymentMethod,
        status: 'PAID',
        note: input.note,
        ...(expenseId ? { expenseId } : {}),
      },
      include: { expense: true },
    });

    ok(res, payment);
  })
);

// Convert payment to expense
landlordContractRouter.post(
  '/:id/payments/:paymentId/convert-expense',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const payment = await prisma.landlordPayment.findFirst({
      where: {
        id: req.params.paymentId,
        landlordContractId: req.params.id,
        organizationId: req.organizationId!,
      },
      include: { apartment: true },
    });
    if (!payment) throw new HttpError(404, '付款记录不存在');

    const expense = await prisma.apartmentExpense.create({
      data: {
        apartmentId: payment.apartmentId,
        name: `房东租金付款 - ${payment.landlordContractId.slice(0, 8)}`,
        amount: payment.paidAmount ?? 0,
        spentAt: payment.paidAt ?? new Date(),
        note: payment.note || payment.voucherNo,
        createdById: req.user!.id,
      },
    });

    const updated = await prisma.landlordPayment.update({
      where: { id: payment.id },
      data: { expenseId: expense.id },
      include: { expense: true },
    });

    ok(res, updated);
  })
);
