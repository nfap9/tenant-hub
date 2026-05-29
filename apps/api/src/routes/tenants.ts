import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from '../middleware/auth.js';
import {
  syncTenantDisplayFields,
} from '../services/tenant.js';
import { getAccountBalance, adjustAccount } from '../services/tenantAccount.js';
import { PERMISSIONS } from '../services/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, ok } from '../utils/http.js';

export const tenantRouter = Router();
tenantRouter.use(requireAuth, requireOrg);

tenantRouter.get(
  '/',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    const tenants = await prisma.tenant.findMany({
      where: {
        organizationId: req.organizationId!,
        deletedAt: null,
      },
      include: {
        _count: { select: { leases: true } },
        account: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, tenants);
  })
);

tenantRouter.get(
  '/search',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    const { phone, name } = z
      .object({
        phone: z.string().optional(),
        name: z.string().optional(),
      })
      .parse(req.query);

    const where: Record<string, unknown> = {
      organizationId: req.organizationId!,
      deletedAt: null,
    };
    if (phone) where.phone = { contains: phone };
    if (name) where.name = { contains: name };

    const tenants = await prisma.tenant.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        idCard: true,
      },
      take: 10,
    });
    ok(res, tenants);
  })
);

tenantRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organizationId!,
      },
      include: {
        account: true,
        leases: {
          include: {
            room: { include: { apartment: true } },
            fees: true,
            deposit: true,
            settlement: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!tenant) throw new HttpError(404, '租客不存在');
    ok(res, tenant);
  })
);

tenantRouter.put(
  '/:id',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        name: z.string().min(1).optional(),
        phone: z.string().min(6).optional(),
        idCard: z.string().optional(),
        emergencyContact: z.string().optional(),
        emergencyPhone: z.string().optional(),
        note: z.string().optional(),
      })
      .parse(req.body);

    const tenant = await prisma.tenant.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organizationId!,
      },
    });
    if (!tenant) throw new HttpError(404, '租客不存在');

    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: input,
    });

    await syncTenantDisplayFields(tenant.id);
    ok(res, updated);
  })
);

tenantRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organizationId!,
      },
    });
    if (!tenant) throw new HttpError(404, '租客不存在');

    const activeLeases = await prisma.lease.count({
      where: { tenantId: tenant.id, status: 'ACTIVE' },
    });
    if (activeLeases > 0)
      throw new HttpError(400, '租客仍有进行中的租约，无法删除');

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { deletedAt: new Date() },
    });
    ok(res, { success: true });
  })
);

tenantRouter.get(
  '/:id/account',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organizationId!,
      },
    });
    if (!tenant) throw new HttpError(404, '租客不存在');
    ok(res, await getAccountBalance(tenant.id));
  })
);

tenantRouter.get(
  '/:id/account/transactions',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(req.query);

    const tenant = await prisma.tenant.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organizationId!,
      },
      include: { account: true },
    });
    if (!tenant) throw new HttpError(404, '租客不存在');
    if (!tenant.account) {
      ok(res, { items: [], total: 0 });
      return;
    }

    const [items, total] = await Promise.all([
      prisma.accountTransaction.findMany({
        where: { tenantAccountId: tenant.account.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.accountTransaction.count({
        where: { tenantAccountId: tenant.account.id },
      }),
    ]);
    ok(res, { items, total });
  })
);

tenantRouter.post(
  '/:id/account/adjust',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        amount: z.coerce.number(),
        note: z.string().optional(),
      })
      .parse(req.body);

    const tenant = await prisma.tenant.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organizationId!,
      },
    });
    if (!tenant) throw new HttpError(404, '租客不存在');

    ok(
      res,
      await adjustAccount(
        tenant.id,
        input.amount,
        input.note ?? null,
        req.user!.id
      )
    );
  })
);
