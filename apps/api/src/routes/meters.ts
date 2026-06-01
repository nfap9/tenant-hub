import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma/client.js';
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from '../middleware/auth.js';
import { createMeter, replaceMeter } from '../services/meter.js';
import { PERMISSIONS } from '../services/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, ok } from '../utils/http.js';

export const meterRouter = Router();
meterRouter.use(requireAuth, requireOrg);

meterRouter.get(
  '/',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const { apartmentId, roomId, meterType, status } = z
      .object({
        apartmentId: z.string().optional(),
        roomId: z.string().optional(),
        meterType: z.enum(['WATER', 'POWER', 'GAS']).optional(),
        status: z.enum(['ACTIVE', 'REMOVED']).optional(),
      })
      .parse(req.query);

    const where: Record<string, unknown> = {
      organizationId: req.organizationId!,
      deletedAt: null,
    };
    if (apartmentId) where.apartmentId = apartmentId;
    if (roomId) where.roomId = roomId;
    if (meterType) where.meterType = meterType;
    if (status) where.status = status;

    const meters = await prisma.meter.findMany({
      where,
      include: {
        room: { select: { id: true, roomNo: true } },
        apartment: { select: { id: true, name: true } },
        parent: { select: { id: true, name: true } },
        subMeters: { select: { id: true, name: true } },
        _count: { select: { readings: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, meters);
  })
);

meterRouter.post(
  '/',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        apartmentId: z.string(),
        roomId: z.string().optional(),
        name: z.string().min(1),
        meterType: z.enum(['WATER', 'POWER', 'GAS']),
        meterNo: z.string().optional(),
        parentId: z.string().optional(),
      })
      .parse(req.body);

    const apartment = await prisma.apartment.findFirst({
      where: { id: input.apartmentId, organizationId: req.organizationId! },
    });
    if (!apartment) throw new HttpError(404, '公寓不存在');

    ok(
      res,
      await createMeter({
        organizationId: req.organizationId!,
        ...input,
      })
    );
  })
);

meterRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const meter = await prisma.meter.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      include: {
        room: { select: { id: true, roomNo: true } },
        apartment: { select: { id: true, name: true } },
        parent: { select: { id: true, name: true } },
        subMeters: { select: { id: true, name: true } },
        readings: {
          orderBy: { readingDate: 'desc' },
          take: 12,
        },
      },
    });
    if (!meter) throw new HttpError(404, '表具不存在');
    ok(res, meter);
  })
);

meterRouter.put(
  '/:id',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        name: z.string().min(1).optional(),
        meterNo: z.string().optional(),
        roomId: z.string().optional(),
      })
      .parse(req.body);

    const meter = await prisma.meter.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!meter) throw new HttpError(404, '表具不存在');

    ok(
      res,
      await prisma.meter.update({ where: { id: meter.id }, data: input })
    );
  })
);

meterRouter.post(
  '/:id/replace',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        name: z.string().optional(),
        meterNo: z.string().optional(),
      })
      .parse(req.body);

    ok(res, await replaceMeter(req.params.id, input));
  })
);

meterRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const meter = await prisma.meter.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!meter) throw new HttpError(404, '表具不存在');

    await prisma.meter.softDelete({ where: { id: meter.id } });
    ok(res, { success: true });
  })
);
