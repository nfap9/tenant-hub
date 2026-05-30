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
import { ok } from '../utils/http.js';

export const cashierJournalRouter = Router();
cashierJournalRouter.use(requireAuth, requireOrg);

const journalInput = z.object({
  date: z.coerce.date(),
  type: z.enum(['INCOME', 'EXPENSE']),
  categoryId: z.string().optional(),
  amount: z.coerce.number().positive(),
  paymentMethod: z.string(),
  accountType: z
    .enum(['CASH', 'BANK', 'WECHAT', 'ALIPAY', 'POS', 'OTHER'])
    .default('CASH'),
  counterparty: z.string().optional(),
  counterpartyId: z.string().optional(),
  relatedDocType: z.string().optional(),
  relatedDocId: z.string().optional(),
  relatedPaymentId: z.string().optional(),
  summary: z.string().min(1),
});

cashierJournalRouter.get(
  '/',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const {
      type,
      startDate,
      endDate,
      categoryId,
      accountType,
      page,
      pageSize,
    } = z
      .object({
        type: z.enum(['INCOME', 'EXPENSE']).optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
        categoryId: z.string().optional(),
        accountType: z
          .enum(['CASH', 'BANK', 'WECHAT', 'ALIPAY', 'POS', 'OTHER'])
          .optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(req.query);

    const where: Record<string, unknown> = {
      organizationId: req.organizationId!,
      ...(type ? { type } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(accountType ? { accountType } : {}),
      ...(startDate || endDate
        ? {
            date: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
    };

    const [items, total, incomeTotal, expenseTotal] = await Promise.all([
      prisma.cashierJournal.findMany({
        where,
        include: {
          operator: { select: { id: true, username: true } },
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.cashierJournal.count({ where }),
      prisma.cashierJournal
        .aggregate({
          where: { ...where, type: 'INCOME' },
          _sum: { amount: true },
        })
        .then((r) => r._sum.amount ?? 0),
      prisma.cashierJournal
        .aggregate({
          where: { ...where, type: 'EXPENSE' },
          _sum: { amount: true },
        })
        .then((r) => r._sum.amount ?? 0),
    ]);

    ok(res, { items, total, incomeTotal, expenseTotal });
  })
);

cashierJournalRouter.post(
  '/',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = journalInput.parse(req.body);
    ok(
      res,
      await prisma.cashierJournal.create({
        data: {
          ...input,
          organizationId: req.organizationId!,
          operatorId: req.user!.id,
        },
        include: {
          operator: { select: { id: true, username: true } },
        },
      })
    );
  })
);

cashierJournalRouter.get(
  '/categories',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const { type } = z
      .object({
        type: z.enum(['INCOME', 'EXPENSE']).optional(),
      })
      .parse(req.query);

    const categories = await prisma.incomeExpenseCategory.findMany({
      where: {
        organizationId: req.organizationId!,
        ...(type ? { type } : {}),
      },
      orderBy: { name: 'asc' },
    });

    ok(res, { categories });
  })
);

cashierJournalRouter.get(
  '/daily-report',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const date = z.coerce.date().parse(req.query.date ?? new Date());
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const end = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() + 1
    );

    const [incomeAgg, expenseAgg, opening] = await Promise.all([
      prisma.cashierJournal.aggregate({
        where: {
          organizationId: req.organizationId!,
          type: 'INCOME',
          date: { gte: start, lt: end },
        },
        _sum: { amount: true },
      }),
      prisma.cashierJournal.aggregate({
        where: {
          organizationId: req.organizationId!,
          type: 'EXPENSE',
          date: { gte: start, lt: end },
        },
        _sum: { amount: true },
      }),
      prisma.cashierJournal.aggregate({
        where: {
          organizationId: req.organizationId!,
          date: { lt: start },
        },
        _sum: { amount: true },
      }),
    ]);

    const income = Number(incomeAgg._sum.amount ?? 0);
    const expense = Number(expenseAgg._sum.amount ?? 0);
    const openingBalance = Number(opening._sum.amount ?? 0);

    ok(res, {
      date: start,
      openingBalance,
      income,
      expense,
      closingBalance: openingBalance + income - expense,
    });
  })
);
