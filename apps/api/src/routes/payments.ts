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

export const paymentRouter = Router();
paymentRouter.use(requireAuth, requireOrg);

paymentRouter.get(
  '/',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const billId = z.string().optional().parse(req.query.billId);
    const tenantId = z.string().optional().parse(req.query.tenantId);
    const payments = await prisma.payment.findMany({
      where: {
        bill: { organizationId: req.organizationId! },
        ...(billId ? { billId } : {}),
        ...(tenantId ? { tenantId } : {}),
      },
      include: {
        bill: {
          select: { id: true, totalAmount: true, status: true },
        },
        user: { select: { id: true, username: true } },
        allocations: {
          include: {
            bill: { select: { id: true, totalAmount: true, status: true } },
          },
        },
      },
      orderBy: { paidAt: 'desc' },
    });
    ok(res, payments);
  })
);

// Payment preview - auto allocation by age (FIFO)
paymentRouter.post(
  '/preview',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        tenantId: z.string(),
        totalAmount: z.coerce.number().positive(),
      })
      .parse(req.body);

    const bills = await prisma.bill.findMany({
      where: {
        organizationId: req.organizationId!,
        lease: { tenantId: input.tenantId },
        status: { in: ['UNPAID', 'PARTIAL_PAID', 'OVERDUE'] },
      },
      include: { lease: { include: { room: true } }, items: true },
      orderBy: { dueDate: 'asc' },
    });

    let remaining = input.totalAmount;
    const allocations: Array<{
      billId: string;
      amount: number;
      billTotal: number;
      billPaid: number;
      billStatus: string;
    }> = [];

    for (const bill of bills) {
      if (remaining <= 0) break;
      const unpaid = Number(bill.totalAmount) - Number(bill.paidAmount);
      const allocate = Math.min(unpaid, remaining);
      allocations.push({
        billId: bill.id,
        amount: allocate,
        billTotal: Number(bill.totalAmount),
        billPaid: Number(bill.paidAmount),
        billStatus: bill.status,
      });
      remaining -= allocate;
    }

    ok(res, {
      totalAmount: input.totalAmount,
      allocated: allocations.reduce((sum, a) => sum + a.amount, 0),
      remaining: remaining > 0 ? remaining : 0,
      allocations,
    });
  })
);

paymentRouter.post(
  '/',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        billIds: z.array(z.string()).min(1),
        totalAmount: z.coerce.number().positive(),
        method: z.string().min(1),
        paidAt: z.coerce.date().default(new Date()),
        note: z.string().optional(),
      })
      .parse(req.body);

    const bills = await prisma.bill.findMany({
      where: {
        id: { in: input.billIds },
        organizationId: req.organizationId!,
        status: { in: ['UNPAID', 'PARTIAL_PAID', 'OVERDUE'] },
      },
    });

    if (bills.length !== input.billIds.length) {
      throw new HttpError(400, '部分账单不存在或已结清');
    }

    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          userId: req.user!.id,
          type: 'RECEIVE',
          amount: input.totalAmount,
          paidAt: input.paidAt,
          method: input.method,
          note: input.note,
          status: 'COMPLETED',
        },
      });

      let remaining = input.totalAmount;
      for (const bill of bills.sort(
        (a, b) => a.dueDate.getTime() - b.dueDate.getTime()
      )) {
        if (remaining <= 0) break;
        const unpaid = Number(bill.totalAmount) - Number(bill.paidAmount);
        const allocate = Math.min(unpaid, remaining);

        await tx.paymentAllocation.create({
          data: {
            paymentId: created.id,
            billId: bill.id,
            allocatedAmount: allocate,
          },
        });

        await tx.bill.update({
          where: { id: bill.id },
          data: {
            paidAmount: { increment: allocate },
            status:
              allocate >= unpaid
                ? 'PAID'
                : allocate > 0
                  ? 'PARTIAL_PAID'
                  : bill.status,
          },
        });

        remaining -= allocate;
      }

      return tx.payment.findUnique({
        where: { id: created.id },
        include: {
          allocations: {
            include: {
              bill: { select: { id: true, totalAmount: true, status: true } },
            },
          },
        },
      });
    });

    ok(res, payment);
  })
);

paymentRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findFirst({
      where: { id: req.params.id },
      include: {
        bill: {
          include: {
            lease: { include: { room: true } },
            items: true,
          },
        },
        user: { select: { id: true, username: true, phone: true } },
        allocations: {
          include: {
            bill: { select: { id: true, totalAmount: true, status: true } },
          },
        },
      },
    });
    if (!payment) throw new HttpError(404, '收款记录不存在');
    if (!payment.bill || payment.bill.organizationId !== req.organizationId)
      throw new HttpError(404, '收款记录不存在');
    ok(res, payment);
  })
);

paymentRouter.get(
  '/:id/allocations',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findFirst({
      where: { id: req.params.id },
      include: {
        bill: { select: { organizationId: true } },
      },
    });
    if (!payment || payment.bill?.organizationId !== req.organizationId) {
      throw new HttpError(404, '收款记录不存在');
    }

    const allocations = await prisma.paymentAllocation.findMany({
      where: { paymentId: req.params.id },
      include: {
        bill: { select: { id: true, totalAmount: true, status: true } },
      },
    });
    ok(res, allocations);
  })
);

paymentRouter.put(
  '/:id',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        method: z.string().optional(),
        note: z.string().optional(),
        paidAt: z.coerce.date().optional(),
      })
      .parse(req.body);

    const payment = await prisma.payment.findFirst({
      where: { id: req.params.id },
      include: { bill: true },
    });
    if (!payment || payment.bill?.organizationId !== req.organizationId) {
      throw new HttpError(404, '收款记录不存在');
    }

    ok(
      res,
      await prisma.payment.update({
        where: { id: req.params.id },
        data: input,
        include: {
          allocations: {
            include: {
              bill: { select: { id: true, totalAmount: true, status: true } },
            },
          },
        },
      })
    );
  })
);

paymentRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findFirst({
      where: { id: req.params.id },
      include: { bill: true, allocations: true },
    });
    if (!payment || payment.bill?.organizationId !== req.organizationId) {
      throw new HttpError(404, '收款记录不存在');
    }

    await prisma.$transaction(async (tx) => {
      for (const alloc of payment.allocations) {
        await tx.bill.update({
          where: { id: alloc.billId },
          data: {
            paidAmount: { decrement: Number(alloc.allocatedAmount) },
          },
        });
      }
      await tx.paymentAllocation.deleteMany({
        where: { paymentId: payment.id },
      });
      await tx.payment.softDelete({ where: { id: payment.id } });
    });

    ok(res, { deleted: true });
  })
);
