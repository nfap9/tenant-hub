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

export const accountRouter = Router();
accountRouter.use(requireAuth, requireOrg);

accountRouter.get(
  '/',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const accounts = await prisma.account.findMany({
      where: { organizationId: req.organizationId! },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, accounts);
  })
);

accountRouter.post(
  '/',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        name: z.string().min(1, '账户名称不能为空'),
        type: z.enum(['CASH', 'BANK', 'WECHAT', 'ALIPAY']),
        bankName: z.string().optional(),
        accountNo: z.string().optional(),
      })
      .parse(req.body);

    const account = await prisma.account.create({
      data: {
        organizationId: req.organizationId!,
        name: input.name,
        type: input.type,
        bankName: input.bankName,
        accountNo: input.accountNo,
      },
    });

    ok(res, account);
  })
);

accountRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const account = await prisma.account.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!account) throw new HttpError(404, '账户不存在');
    ok(res, account);
  })
);

accountRouter.put(
  '/:id',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        name: z.string().min(1).optional(),
        type: z.enum(['CASH', 'BANK', 'WECHAT', 'ALIPAY']).optional(),
        bankName: z.string().optional(),
        accountNo: z.string().optional(),
      })
      .parse(req.body);

    const account = await prisma.account.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!account) throw new HttpError(404, '账户不存在');

    const updated = await prisma.account.update({
      where: { id: req.params.id },
      data: input,
    });

    ok(res, updated);
  })
);

accountRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const account = await prisma.account.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!account) throw new HttpError(404, '账户不存在');
    if (Number(account.balance) !== 0)
      throw new HttpError(400, '账户余额不为零，不能删除');

    await prisma.account.delete({ where: { id: req.params.id } });
    ok(res, { deleted: true });
  })
);

accountRouter.post(
  '/transfer',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        fromAccountId: z.string().min(1),
        toAccountId: z.string().min(1),
        amount: z.coerce.number().positive(),
        note: z.string().optional(),
      })
      .refine(
        (v) => v.fromAccountId !== v.toAccountId,
        '转出和转入账户不能相同'
      )
      .parse(req.body);

    const [fromAccount, toAccount] = await Promise.all([
      prisma.account.findFirst({
        where: {
          id: input.fromAccountId,
          organizationId: req.organizationId!,
        },
      }),
      prisma.account.findFirst({
        where: {
          id: input.toAccountId,
          organizationId: req.organizationId!,
        },
      }),
    ]);

    if (!fromAccount) throw new HttpError(404, '转出账户不存在');
    if (!toAccount) throw new HttpError(404, '转入账户不存在');
    if (Number(fromAccount.balance) < input.amount)
      throw new HttpError(400, '转出账户余额不足');

    const transfer = await prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: input.fromAccountId },
        data: { balance: { decrement: input.amount } },
      });
      await tx.account.update({
        where: { id: input.toAccountId },
        data: { balance: { increment: input.amount } },
      });
      return tx.accountTransfer.create({
        data: {
          organizationId: req.organizationId!,
          fromAccountId: input.fromAccountId,
          toAccountId: input.toAccountId,
          amount: input.amount,
          note: input.note,
          createdById: req.user!.id,
        },
      });
    });

    ok(res, transfer);
  })
);

accountRouter.get(
  '/:id/transfers',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const account = await prisma.account.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!account) throw new HttpError(404, '账户不存在');

    const transfers = await prisma.accountTransfer.findMany({
      where: {
        organizationId: req.organizationId!,
        OR: [{ fromAccountId: req.params.id }, { toAccountId: req.params.id }],
      },
      orderBy: { createdAt: 'desc' },
    });

    ok(res, transfers);
  })
);

accountRouter.get(
  '/transfers/all',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const transfers = await prisma.accountTransfer.findMany({
      where: { organizationId: req.organizationId! },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, transfers);
  })
);
