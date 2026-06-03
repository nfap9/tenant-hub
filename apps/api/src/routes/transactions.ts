import { Router } from 'express';
import { z } from 'zod';
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from '../middleware/auth.js';
import { PERMISSIONS } from '../services/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, ok } from '../utils/http.js';
import {
  createTransaction,
  deleteTransaction,
  getTransactionById,
  getTransactionSummary,
  listTransactions,
  TRANSACTION_CATEGORIES,
} from '../services/transaction.js';

export const transactionRouter = Router();
transactionRouter.use(requireAuth, requireOrg);

transactionRouter.get(
  '/',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        type: z.enum(['INCOME', 'EXPENSE']).optional(),
        category: z.string().optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
        method: z.string().optional(),
        apartmentId: z.string().optional(),
        leaseId: z.string().optional(),
        sourceType: z
          .enum([
            'BILL_PAYMENT',
            'DEPOSIT_PAYMENT',
            'SETTLEMENT_PAYMENT',
            'APARTMENT_EXPENSE',
            'RESERVATION',
            'MANUAL',
          ])
          .optional(),
        keyword: z.string().optional(),
        page: z.coerce.number().min(1).default(1),
        pageSize: z.coerce.number().min(1).max(100).default(20),
      })
      .parse(req.query);

    ok(
      res,
      await listTransactions({
        organizationId: req.organizationId!,
        ...query,
      })
    );
  })
);

transactionRouter.get(
  '/summary',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
      })
      .parse(req.query);

    ok(
      res,
      await getTransactionSummary({
        organizationId: req.organizationId!,
        ...query,
      })
    );
  })
);

transactionRouter.get(
  '/categories',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    ok(
      res,
      Object.entries(TRANSACTION_CATEGORIES).map(([key, value]) => ({
        key,
        label: value.label,
        type: value.type,
      }))
    );
  })
);

transactionRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const transaction = await getTransactionById(
      req.params.id,
      req.organizationId!
    );
    if (!transaction) throw new HttpError(404, '收支记录不存在');
    ok(res, transaction);
  })
);

transactionRouter.post(
  '/',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        type: z.enum(['INCOME', 'EXPENSE']),
        category: z.string().min(1),
        amount: z.coerce.number().positive(),
        method: z.string().min(1),
        occurredAt: z.coerce.date().optional(),
        apartmentId: z.string().optional(),
        note: z.string().optional(),
      })
      .parse(req.body);

    const transaction = await createTransaction({
      organizationId: req.organizationId!,
      operatorId: req.user!.id,
      sourceType: 'MANUAL',
      sourceId: 'manual',
      ...input,
    });

    ok(res, transaction);
  })
);

transactionRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const result = await deleteTransaction(req.params.id, req.organizationId!);
    if (!result) throw new HttpError(404, '收支记录不存在');
    ok(res, { deleted: true });
  })
);
