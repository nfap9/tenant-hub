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

export const refundRouter = Router();
refundRouter.use(requireAuth, requireOrg);

refundRouter.get(
  '/',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const status = z
      .enum(['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'])
      .optional()
      .parse(req.query.status);

    const refunds = await prisma.refund.findMany({
      where: {
        organizationId: req.organizationId!,
        ...(status ? { status } : {}),
      },
      include: {
        tenant: { select: { id: true, name: true, phone: true } },
        approver: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    ok(
      res,
      refunds.map((r) => ({
        ...r,
        tenantName: r.tenant.name,
        tenantPhone: r.tenant.phone,
        approver: r.approver?.username ?? null,
      }))
    );
  })
);

refundRouter.post(
  '/',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        tenantId: z.string().min(1),
        type: z.enum(['DEPOSIT', 'PREPAID', 'OVERPAY']),
        amount: z.coerce.number().positive(),
        reason: z.string().min(1, '退款原因不能为空'),
      })
      .parse(req.body);

    const tenant = await prisma.tenant.findFirst({
      where: { id: input.tenantId, organizationId: req.organizationId! },
    });
    if (!tenant) throw new HttpError(404, '租客不存在');

    const refund = await prisma.refund.create({
      data: {
        organizationId: req.organizationId!,
        tenantId: input.tenantId,
        type: input.type,
        amount: input.amount,
        reason: input.reason,
        createdById: req.user!.id,
      },
      include: {
        tenant: { select: { id: true, name: true, phone: true } },
      },
    });

    ok(res, {
      ...refund,
      tenantName: refund.tenant.name,
      tenantPhone: refund.tenant.phone,
    });
  })
);

refundRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const refund = await prisma.refund.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      include: {
        tenant: { select: { id: true, name: true, phone: true } },
        approver: { select: { id: true, username: true } },
      },
    });
    if (!refund) throw new HttpError(404, '退款记录不存在');

    ok(res, {
      ...refund,
      tenantName: refund.tenant.name,
      tenantPhone: refund.tenant.phone,
      approver: refund.approver?.username ?? null,
    });
  })
);

refundRouter.put(
  '/:id',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        type: z.enum(['DEPOSIT', 'PREPAID', 'OVERPAY']).optional(),
        amount: z.coerce.number().positive().optional(),
        reason: z.string().min(1).optional(),
      })
      .parse(req.body);

    const existing = await prisma.refund.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!existing) throw new HttpError(404, '退款记录不存在');
    if (existing.status !== 'PENDING')
      throw new HttpError(400, '仅待审批状态的退款可申请修改');

    const refund = await prisma.refund.update({
      where: { id: req.params.id },
      data: input,
      include: {
        tenant: { select: { id: true, name: true, phone: true } },
      },
    });

    ok(res, {
      ...refund,
      tenantName: refund.tenant.name,
      tenantPhone: refund.tenant.phone,
    });
  })
);

refundRouter.patch(
  '/:id/approve',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const refund = await prisma.refund.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!refund) throw new HttpError(404, '退款记录不存在');
    if (refund.status !== 'PENDING')
      throw new HttpError(400, '仅待审批状态的退款可批准');

    const updated = await prisma.refund.update({
      where: { id: req.params.id },
      data: {
        status: 'APPROVED',
        approverId: req.user!.id,
        approvedAt: new Date(),
      },
      include: {
        tenant: { select: { id: true, name: true, phone: true } },
        approver: { select: { id: true, username: true } },
      },
    });

    ok(res, {
      ...updated,
      tenantName: updated.tenant.name,
      tenantPhone: updated.tenant.phone,
      approver: updated.approver?.username ?? null,
    });
  })
);

refundRouter.patch(
  '/:id/reject',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({ note: z.string().min(1, '拒绝原因不能为空') })
      .parse(req.body);

    const refund = await prisma.refund.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!refund) throw new HttpError(404, '退款记录不存在');
    if (refund.status !== 'PENDING')
      throw new HttpError(400, '仅待审批状态的退款可拒绝');

    const updated = await prisma.refund.update({
      where: { id: req.params.id },
      data: {
        status: 'REJECTED',
        approverId: req.user!.id,
        approvedAt: new Date(),
        note: input.note,
      },
      include: {
        tenant: { select: { id: true, name: true, phone: true } },
        approver: { select: { id: true, username: true } },
      },
    });

    ok(res, {
      ...updated,
      tenantName: updated.tenant.name,
      tenantPhone: updated.tenant.phone,
      approver: updated.approver?.username ?? null,
    });
  })
);

refundRouter.patch(
  '/:id/execute',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const refund = await prisma.refund.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!refund) throw new HttpError(404, '退款记录不存在');
    if (refund.status !== 'APPROVED')
      throw new HttpError(400, '仅已批准状态的退款可执行');

    const updated = await prisma.refund.update({
      where: { id: req.params.id },
      data: { status: 'COMPLETED' },
      include: {
        tenant: { select: { id: true, name: true, phone: true } },
        approver: { select: { id: true, username: true } },
      },
    });

    ok(res, {
      ...updated,
      tenantName: updated.tenant.name,
      tenantPhone: updated.tenant.phone,
      approver: updated.approver?.username ?? null,
    });
  })
);
