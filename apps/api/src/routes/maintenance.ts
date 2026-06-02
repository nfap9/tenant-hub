import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma/client.js';
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from '../middleware/auth.js';
import { PERMISSIONS } from '../services/roles.js';
import { createNotification } from '../services/notification.js';
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
  materialCost: z.coerce.number().optional(),
  laborCost: z.coerce.number().optional(),
  beforePhotoUrl: z.string().optional(),
  afterPhotoUrl: z.string().optional(),
  acceptanceNote: z.string().optional(),
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
        deletedAt: null,
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
    const order = await prisma.maintenanceOrder.create({
      data: {
        ...input,
        organizationId: req.organizationId!,
        createdById: req.user!.id,
      },
      include: { apartment: true, room: true, items: true },
    });
    await createNotification({
      organizationId: req.organizationId!,
      userId: req.user!.id,
      type: 'MAINTENANCE_CREATED',
      title: '新维修工单',
      content: `工单「${order.title}」已创建`,
      link: `/maintenance/${order.id}`,
    }).catch(() => {});
    ok(res, order);
  })
);

maintenanceRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    const order = await prisma.maintenanceOrder.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organizationId!,
        deletedAt: null,
      },
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
      where: {
        id: req.params.id,
        organizationId: req.organizationId!,
        deletedAt: null,
      },
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

// Status change with state machine validation
maintenanceRouter.post(
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
      })
      .parse(req.body);

    const order = await prisma.maintenanceOrder.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organizationId!,
        deletedAt: null,
      },
    });
    if (!order) throw new HttpError(404, '工单不存在');

    const validTransitions: Record<string, string[]> = {
      PENDING: ['DISPATCHED', 'CANCELLED'],
      DISPATCHED: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['AWAITING_ACCEPTANCE', 'CANCELLED'],
      AWAITING_ACCEPTANCE: ['COMPLETED', 'IN_PROGRESS'],
      COMPLETED: [],
      CANCELLED: [],
    };

    if (!validTransitions[order.status]?.includes(input.status)) {
      throw new HttpError(400, `不能从 ${order.status} 变更为 ${input.status}`);
    }

    const data: Record<string, unknown> = { status: input.status };
    if (input.status === 'COMPLETED') data.completedDate = new Date();

    const updated = await prisma.maintenanceOrder.update({
      where: { id: req.params.id },
      data,
      include: { apartment: true, room: true, items: true },
    });

    if (input.status === 'COMPLETED') {
      await createNotification({
        organizationId: req.organizationId!,
        userId: order.createdById || req.user!.id,
        type: 'MAINTENANCE_COMPLETED',
        title: '维修工单已完成',
        content: `工单「${order.title}」已完成`,
        link: `/maintenance/${order.id}`,
      }).catch(() => {});
    }

    ok(res, updated);
  })
);

// Assign maintenance worker
maintenanceRouter.post(
  '/:id/assign',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z.object({ assignedTo: z.string().min(1) }).parse(req.body);

    const order = await prisma.maintenanceOrder.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organizationId!,
        deletedAt: null,
      },
    });
    if (!order) throw new HttpError(404, '工单不存在');

    const updated = await prisma.maintenanceOrder.update({
      where: { id: req.params.id },
      data: {
        assignedTo: input.assignedTo,
        status: 'DISPATCHED',
      },
      include: { apartment: true, room: true, items: true },
    });

    ok(res, updated);
  })
);

// Complete with photos and costs
maintenanceRouter.post(
  '/:id/complete',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        afterPhotoUrl: z.string().optional(),
        materialCost: z.coerce.number().default(0),
        laborCost: z.coerce.number().default(0),
        totalCost: z.coerce.number().optional(),
        isTenantFault: z.boolean().default(false),
        acceptanceNote: z.string().optional(),
      })
      .parse(req.body);

    const order = await prisma.maintenanceOrder.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organizationId!,
        deletedAt: null,
      },
    });
    if (!order) throw new HttpError(404, '工单不存在');
    if (
      order.status !== 'IN_PROGRESS' &&
      order.status !== 'AWAITING_ACCEPTANCE'
    ) {
      throw new HttpError(400, '仅处理中或待验收的工单可以完成');
    }

    const totalCost = input.totalCost ?? input.materialCost + input.laborCost;

    const updated = await prisma.maintenanceOrder.update({
      where: { id: req.params.id },
      data: {
        ...input,
        totalCost,
        status: 'AWAITING_ACCEPTANCE',
        completedDate: new Date(),
      },
      include: { apartment: true, room: true, items: true },
    });

    ok(res, updated);
  })
);

// Accept work
maintenanceRouter.post(
  '/:id/accept',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({ acceptanceNote: z.string().optional() })
      .parse(req.body);

    const order = await prisma.maintenanceOrder.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organizationId!,
        deletedAt: null,
      },
    });
    if (!order) throw new HttpError(404, '工单不存在');
    if (order.status !== 'AWAITING_ACCEPTANCE') {
      throw new HttpError(400, '仅待验收状态的工单可以验收');
    }

    const updated = await prisma.maintenanceOrder.update({
      where: { id: req.params.id },
      data: {
        status: 'COMPLETED',
        acceptanceNote: input.acceptanceNote,
      },
      include: { apartment: true, room: true, items: true },
    });

    await createNotification({
      organizationId: req.organizationId!,
      userId: order.createdById || req.user!.id,
      type: 'MAINTENANCE_COMPLETED',
      title: '维修工单已验收',
      content: `工单「${order.title}」已验收完成`,
      link: `/maintenance/${order.id}`,
    }).catch(() => {});

    ok(res, updated);
  })
);

maintenanceRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const order = await prisma.maintenanceOrder.findFirst({
      where: {
        id: req.params.id,
        organizationId: req.organizationId!,
        deletedAt: null,
      },
    });
    if (!order) throw new HttpError(404, '工单不存在');
    await prisma.maintenanceOrder.softDelete({ where: { id: req.params.id } });
    ok(res, { deleted: true });
  })
);
