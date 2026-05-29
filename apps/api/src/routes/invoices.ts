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

export const invoiceRouter = Router();
invoiceRouter.use(requireAuth, requireOrg);

const invoiceInput = z.object({
  tenantId: z.string().optional(),
  billId: z.string().optional(),
  title: z.string().min(1),
  taxNo: z.string().optional(),
  amount: z.coerce.number().positive(),
  content: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  note: z.string().optional(),
});

invoiceRouter.get(
  '/',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const status = z
      .enum(['PENDING', 'ISSUED', 'SENT', 'RECEIVED'])
      .optional()
      .parse(req.query.status);
    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId: req.organizationId!,
        ...(status ? { status } : {}),
      },
      include: {
        tenant: true,
        bill: { include: { lease: { include: { room: true } } } },
        createdBy: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, invoices);
  })
);

invoiceRouter.post(
  '/',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = invoiceInput.parse(req.body);
    ok(
      res,
      await prisma.invoice.create({
        data: {
          ...input,
          organizationId: req.organizationId!,
          createdById: req.user!.id,
        },
        include: {
          tenant: true,
          bill: true,
          createdBy: { select: { id: true, username: true } },
        },
      })
    );
  })
);

invoiceRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      include: {
        tenant: true,
        bill: true,
        createdBy: { select: { id: true, username: true } },
      },
    });
    if (!invoice) throw new HttpError(404, '发票不存在');
    ok(res, invoice);
  })
);

invoiceRouter.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        status: z.enum(['PENDING', 'ISSUED', 'SENT', 'RECEIVED']),
        issuedAt: z.coerce.date().optional(),
        sentAt: z.coerce.date().optional(),
        receivedAt: z.coerce.date().optional(),
      })
      .parse(req.body);
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!invoice) throw new HttpError(404, '发票不存在');

    const data: Record<string, unknown> = { status: input.status };
    if (input.issuedAt !== undefined) data.issuedAt = input.issuedAt;
    if (input.sentAt !== undefined) data.sentAt = input.sentAt;
    if (input.receivedAt !== undefined) data.receivedAt = input.receivedAt;
    if (input.status === 'ISSUED' && !invoice.issuedAt)
      data.issuedAt = new Date();
    if (input.status === 'SENT' && !invoice.sentAt) data.sentAt = new Date();
    if (input.status === 'RECEIVED' && !invoice.receivedAt)
      data.receivedAt = new Date();

    ok(
      res,
      await prisma.invoice.update({
        where: { id: req.params.id },
        data,
        include: {
          tenant: true,
          bill: true,
          createdBy: { select: { id: true, username: true } },
        },
      })
    );
  })
);
