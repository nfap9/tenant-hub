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

export const roomChecklistRouter = Router();
roomChecklistRouter.use(requireAuth, requireOrg);

roomChecklistRouter.get(
  '/',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    const leaseId = z.string().optional().parse(req.query.leaseId);
    const roomId = z.string().optional().parse(req.query.roomId);
    const checkType = z
      .enum(['CHECKIN', 'CHECKOUT'])
      .optional()
      .parse(req.query.checkType);
    const checklists = await prisma.roomChecklist.findMany({
      where: {
        organizationId: req.organizationId!,
        ...(leaseId ? { leaseId } : {}),
        ...(roomId ? { roomId } : {}),
        ...(checkType ? { checkType } : {}),
      },
      include: {
        lease: { include: { room: { include: { apartment: true } } } },
        room: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, checklists);
  })
);

roomChecklistRouter.post(
  '/',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        leaseId: z.string(),
        roomId: z.string(),
        checkType: z.enum(['CHECKIN', 'CHECKOUT']),
        checkDate: z.coerce.date(),
        tenantSignUrl: z.string().optional(),
        operatorSignUrl: z.string().optional(),
        note: z.string().optional(),
        items: z
          .array(
            z.object({
              category: z.string(),
              itemName: z.string(),
              status: z.string(), // 完好/损坏/缺失/脏污
              description: z.string().optional(),
              photoUrl: z.string().optional(),
              deductionAmount: z.coerce.number().optional(),
              note: z.string().optional(),
            })
          )
          .default([]),
      })
      .parse(req.body);

    const { items, ...data } = input;
    ok(
      res,
      await prisma.roomChecklist.create({
        data: {
          ...data,
          organizationId: req.organizationId!,
          checkedById: req.user!.id,
          items: { create: items },
        },
        include: {
          lease: { include: { room: { include: { apartment: true } } } },
          room: true,
          items: true,
        },
      })
    );
  })
);

roomChecklistRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    const checklist = await prisma.roomChecklist.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      include: {
        lease: { include: { room: { include: { apartment: true } } } },
        room: true,
        items: true,
      },
    });
    if (!checklist) throw new HttpError(404, '检查清单不存在');
    ok(res, checklist);
  })
);

roomChecklistRouter.put(
  '/:id',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        checkDate: z.coerce.date().optional(),
        tenantSignUrl: z.string().optional(),
        operatorSignUrl: z.string().optional(),
        note: z.string().optional(),
        items: z
          .array(
            z.object({
              id: z.string().optional(),
              category: z.string(),
              itemName: z.string(),
              status: z.string(),
              description: z.string().optional(),
              photoUrl: z.string().optional(),
              deductionAmount: z.coerce.number().optional(),
              note: z.string().optional(),
            })
          )
          .optional(),
      })
      .parse(req.body);

    const checklist = await prisma.roomChecklist.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      include: { items: true },
    });
    if (!checklist) throw new HttpError(404, '检查清单不存在');

    const { items, ...data } = input;
    const updated = await prisma.$transaction(async (tx) => {
      if (items) {
        await tx.roomChecklistItem.deleteMany({
          where: { checklistId: checklist.id },
        });
        await tx.roomChecklistItem.createMany({
          data: items.map((item) => ({ ...item, checklistId: checklist.id })),
        });
      }
      return tx.roomChecklist.update({
        where: { id: checklist.id },
        data,
        include: {
          lease: { include: { room: { include: { apartment: true } } } },
          room: true,
          items: true,
        },
      });
    });
    ok(res, updated);
  })
);

roomChecklistRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const checklist = await prisma.roomChecklist.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!checklist) throw new HttpError(404, '检查清单不存在');
    await prisma.roomChecklist.delete({ where: { id: req.params.id } });
    ok(res, { deleted: true });
  })
);
