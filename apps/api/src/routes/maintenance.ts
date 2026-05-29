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

export const maintenanceRouter = Router();
maintenanceRouter.use(requireAuth, requireOrg);

const orderInput = z.object({
  apartmentId: z.string().optional(),
  roomId: z.string().optional(),
  type: z.enum([
    'WATER_ELECTRIC',
    'DOOR_WINDOW',
    'WALL',
    'FURNITURE_APPLIANCE',
    'NETWORK',
    'PIPE',
    'CLEANING',
    'OTHER',
  ]),
  priority: z.enum(['URGENT', 'NORMAL', 'LOW']).default('NORMAL'),
  title: z.string().min(1),
  description: z.string().optional(),
  reporterName: z.string().optional(),
  reporterPhone: z.string().optional(),
  scheduledDate: z.coerce.date().optional(),
  assignedTo: z.string().optional(),
});

maintenanceRouter.get(
  '/',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    const status = z
      .enum([
        'PENDING',
        'DISPATCHED',
        'IN_PROGRESS',
        'AWAITING_ACCEPTANCE',
        'COMPLETED',
        'CANCELLED',
      ])
      .optional()
      .parse(req.query.status);
    const orders = await prisma.maintenanceOrder.findMany({
      where: {
        organizationId: req.organizationId!,
        ...(status ? { status } : {}),
      },
      include: {
        apartment: true,
        room: true,
        items: true,
        createdBy: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, orders);
  })
);

maintenanceRouter.post(
  '/',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = orderInput.parse(req.body);
    ok(
      res,
      await prisma.maintenanceOrder.create({
        data: {
          ...input,
          organizationId: req.organizationId!,
          createdById: req.user!.id,
        },
        include: { apartment: true, room: true, items: true },
      })
    );
  })
);

maintenanceRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    const order = await prisma.maintenanceOrder.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      include: {
        apartment: true,
        room: true,
        items: true,
        createdBy: { select: { id: true, username: true } },
      },
    });
    if (!order) throw new HttpError(404, '工单不存在');
    ok(res, order);
  })
);

maintenanceRouter.put(
  '/:id',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = orderInput.partial().parse(req.body);
    const order = await prisma.maintenanceOrder.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!order) throw new HttpError(404, '工单不存在');
    ok(
      res,
      await prisma.maintenanceOrder.update({
        where: { id: req.params.id },
        data: input,
        include: { apartment: true, room: true, items: true },
      })
    );
  })
);

maintenanceRouter.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        status: z.enum([
          'PENDING',
          'DISPATCHED',
          'IN_PROGRESS',
          'AWAITING_ACCEPTANCE',
          'COMPLETED',
          'CANCELLED',
        ]),
        assignedTo: z.string().optional(),
        acceptanceNote: z.string().optional(),
        materialCost: z.coerce.number().optional(),
        laborCost: z.coerce.number().optional(),
        totalCost: z.coerce.number().optional(),
        isTenantFault: z.boolean().optional(),
      })
      .parse(req.body);
    const order = await prisma.maintenanceOrder.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!order) throw new HttpError(404, '工单不存在');

    const data: Record<string, unknown> = { status: input.status };
    if (input.assignedTo !== undefined) data.assignedTo = input.assignedTo;
    if (input.acceptanceNote !== undefined)
      data.acceptanceNote = input.acceptanceNote;
    if (input.materialCost !== undefined)
      data.materialCost = input.materialCost;
    if (input.laborCost !== undefined) data.laborCost = input.laborCost;
    if (input.totalCost !== undefined) data.totalCost = input.totalCost;
    if (input.isTenantFault !== undefined)
      data.isTenantFault = input.isTenantFault;
    if (input.status === 'COMPLETED') data.completedDate = new Date();

    ok(
      res,
      await prisma.maintenanceOrder.update({
        where: { id: req.params.id },
        data,
        include: { apartment: true, room: true, items: true },
      })
    );
  })
);

maintenanceRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const order = await prisma.maintenanceOrder.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!order) throw new HttpError(404, '工单不存在');
    await prisma.maintenanceOrder.delete({ where: { id: req.params.id } });
    ok(res, { deleted: true });
  })
);
