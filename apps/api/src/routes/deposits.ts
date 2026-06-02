import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma/client.js';
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from '../middleware/auth.js';
import {
  getDepositSummary,
  recordDepositPayment,
} from '../services/deposit.js';
import { PERMISSIONS } from '../services/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, ok } from '../utils/http.js';

export const depositRouter = Router();
depositRouter.use(requireAuth, requireOrg);

depositRouter.get(
  '/',
  requirePermission(PERMISSIONS.DEPOSIT_VIEW),
  asyncHandler(async (req, res) => {
    const status = z
      .enum([
        'UNPAID',
        'PAID',
        'PARTIAL_REFUNDED',
        'FULLY_REFUNDED',
        'DEDUCTED',
      ])
      .optional()
      .parse(req.query.status);
    ok(
      res,
      await prisma.deposit.findMany({
        where: {
          organizationId: req.organizationId!,
          ...(status ? { status } : {}),
        },
        include: {
          lease: {
            include: {
              room: { include: { apartment: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    );
  })
);

depositRouter.get(
  '/summary',
  requirePermission(PERMISSIONS.DEPOSIT_VIEW),
  asyncHandler(async (req, res) => {
    ok(res, await getDepositSummary(req.organizationId!));
  })
);

depositRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.DEPOSIT_VIEW),
  asyncHandler(async (req, res) => {
    const deposit = await prisma.deposit.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      include: {
        lease: {
          include: {
            room: { include: { apartment: true } },
            bills: {
              where: { mode: 'DEPOSIT' },
              include: { payments: { include: { user: true } } },
              orderBy: { billingDate: 'asc' },
            },
          },
        },
        bill: { include: { payments: { include: { user: true } } } },
        depositLedgers: {
          orderBy: { createdAt: 'desc' },
          include: { operator: { select: { id: true, username: true } } },
        },
      },
    });
    if (!deposit) throw new HttpError(404, '押金记录不存在');
    ok(res, deposit);
  })
);

// Collect deposit
depositRouter.post(
  '/:id/collect',
  requirePermission(PERMISSIONS.DEPOSIT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        amount: z.coerce.number().positive(),
        method: z.string().min(1),
        note: z.string().optional(),
      })
      .parse(req.body);

    const deposit = await prisma.deposit.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!deposit) throw new HttpError(404, '押金记录不存在');

    ok(
      res,
      await recordDepositPayment({
        depositId: deposit.id,
        userId: req.user!.id,
        type: 'COLLECT',
        ...input,
      })
    );
  })
);

// Deduct deposit
depositRouter.post(
  '/:id/deduct',
  requirePermission(PERMISSIONS.DEPOSIT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        amount: z.coerce.number().positive(),
        reason: z.string().min(1),
        note: z.string().optional(),
      })
      .parse(req.body);

    const deposit = await prisma.deposit.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!deposit) throw new HttpError(404, '押金记录不存在');
    if (
      Number(deposit.paidAmount) -
        Number(deposit.deductedAmount) -
        Number(deposit.refundedAmount) <
      input.amount
    ) {
      throw new HttpError(400, '抵扣金额超过可用押金余额');
    }

    ok(
      res,
      await recordDepositPayment({
        depositId: deposit.id,
        userId: req.user!.id,
        type: 'DEDUCT',
        amount: input.amount,
        method: 'DEDUCT',
        note: input.reason + (input.note ? `; ${input.note}` : ''),
      })
    );
  })
);

// Refund deposit
depositRouter.post(
  '/:id/refund',
  requirePermission(PERMISSIONS.DEPOSIT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        amount: z.coerce.number().positive(),
        method: z.string().min(1),
        note: z.string().optional(),
      })
      .parse(req.body);

    const deposit = await prisma.deposit.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!deposit) throw new HttpError(404, '押金记录不存在');
    if (
      Number(deposit.paidAmount) -
        Number(deposit.deductedAmount) -
        Number(deposit.refundedAmount) <
      input.amount
    ) {
      throw new HttpError(400, '退还金额超过可用押金余额');
    }

    ok(
      res,
      await recordDepositPayment({
        depositId: deposit.id,
        userId: req.user!.id,
        type: 'REFUND',
        ...input,
      })
    );
  })
);
