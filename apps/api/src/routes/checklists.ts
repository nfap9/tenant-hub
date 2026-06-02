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

export const checklistRouter = Router();
checklistRouter.use(requireAuth, requireOrg);

checklistRouter.get(
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

checklistRouter.post(
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
              status: z.string(),
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

checklistRouter.get(
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

checklistRouter.get(
  '/:id/comparison',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    const checklist = await prisma.roomChecklist.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      include: {
        lease: true,
        items: true,
      },
    });
    if (!checklist) throw new HttpError(404, '检查清单不存在');

    // 查找对应的入住/退租清单
    const counterpart = await prisma.roomChecklist.findFirst({
      where: {
        leaseId: checklist.leaseId,
        roomId: checklist.roomId,
        checkType: checklist.checkType === 'CHECKIN' ? 'CHECKOUT' : 'CHECKIN',
        organizationId: req.organizationId!,
      },
      include: { items: true },
    });

    const comparison = {
      checkout: checklist.checkType === 'CHECKOUT' ? checklist : counterpart,
      checkin: checklist.checkType === 'CHECKIN' ? checklist : counterpart,
      deductionSuggestions: [] as Array<{
        itemName: string;
        checkinStatus: string;
        checkoutStatus: string;
        suggestedAmount: number;
      }>,
    };

    if (counterpart) {
      const checkoutItems =
        checklist.checkType === 'CHECKOUT'
          ? checklist.items
          : counterpart.items;
      const checkinItems =
        checklist.checkType === 'CHECKIN' ? checklist.items : counterpart.items;

      for (const coItem of checkoutItems) {
        const ciItem = checkinItems.find((i) => i.itemName === coItem.itemName);
        if (ciItem && ciItem.status === '完好' && coItem.status !== '完好') {
          comparison.deductionSuggestions.push({
            itemName: coItem.itemName,
            checkinStatus: ciItem.status,
            checkoutStatus: coItem.status,
            suggestedAmount: Number(coItem.deductionAmount ?? 0),
          });
        }
      }
    }

    ok(res, comparison);
  })
);

checklistRouter.put(
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

checklistRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const checklist = await prisma.roomChecklist.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!checklist) throw new HttpError(404, '检查清单不存在');
    await prisma.roomChecklist.softDelete({ where: { id: req.params.id } });
    ok(res, { deleted: true });
  })
);
