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

export const coResidentRouter = Router();
coResidentRouter.use(requireAuth, requireOrg);

const coResidentInput = z.object({
  tenantId: z.string(),
  leaseId: z.string(),
  name: z.string().min(1),
  idCard: z.string().optional(),
  phone: z.string().optional(),
  relation: z.string(),
});

coResidentRouter.get(
  '/',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    const tenantId = z.string().optional().parse(req.query.tenantId);
    const leaseId = z.string().optional().parse(req.query.leaseId);
    const residents = await prisma.coResident.findMany({
      where: {
        tenant: { organizationId: req.organizationId! },
        ...(tenantId ? { tenantId } : {}),
        ...(leaseId ? { leaseId } : {}),
      },
      include: { tenant: true, lease: { include: { room: true } } },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, residents);
  })
);

coResidentRouter.post(
  '/',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = coResidentInput.parse(req.body);
    const tenant = await prisma.tenant.findFirst({
      where: { id: input.tenantId, organizationId: req.organizationId! },
    });
    if (!tenant) throw new HttpError(404, '租客不存在');
    const lease = await prisma.lease.findFirst({
      where: { id: input.leaseId, organizationId: req.organizationId! },
    });
    if (!lease) throw new HttpError(404, '租约不存在');
    ok(
      res,
      await prisma.coResident.create({
        data: input,
        include: { tenant: true, lease: { include: { room: true } } },
      })
    );
  })
);

coResidentRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    const resident = await prisma.coResident.findFirst({
      where: {
        id: req.params.id,
        tenant: { organizationId: req.organizationId! },
      },
      include: { tenant: true, lease: { include: { room: true } } },
    });
    if (!resident) throw new HttpError(404, '同住人不存在');
    ok(res, resident);
  })
);

coResidentRouter.put(
  '/:id',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = coResidentInput.partial().parse(req.body);
    const resident = await prisma.coResident.findFirst({
      where: {
        id: req.params.id,
        tenant: { organizationId: req.organizationId! },
      },
    });
    if (!resident) throw new HttpError(404, '同住人不存在');
    ok(
      res,
      await prisma.coResident.update({
        where: { id: req.params.id },
        data: input,
        include: { tenant: true, lease: { include: { room: true } } },
      })
    );
  })
);

coResidentRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const resident = await prisma.coResident.findFirst({
      where: {
        id: req.params.id,
        tenant: { organizationId: req.organizationId! },
      },
    });
    if (!resident) throw new HttpError(404, '同住人不存在');
    await prisma.coResident.delete({ where: { id: req.params.id } });
    ok(res, { deleted: true });
  })
);
