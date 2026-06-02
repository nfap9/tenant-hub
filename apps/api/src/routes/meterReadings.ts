import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma/client.js';
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from '../middleware/auth.js';
import {
  calculateUtilityLineAmounts,
  detectAbnormalUsage,
} from '../services/billing.js';
import { PERMISSIONS } from '../services/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, ok } from '../utils/http.js';

export const meterReadingRouter = Router();
meterReadingRouter.use(requireAuth, requireOrg);

meterReadingRouter.get(
  '/',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const { apartmentId, roomId, meterType, leaseId } = z
      .object({
        apartmentId: z.string().optional(),
        roomId: z.string().optional(),
        meterType: z.enum(['WATER', 'POWER', 'GAS']).optional(),
        leaseId: z.string().optional(),
      })
      .parse(req.query);

    const where: Record<string, unknown> = {
      organizationId: req.organizationId!,
      deletedAt: null,
    };
    if (apartmentId) where.apartmentId = apartmentId;
    if (roomId) where.roomId = roomId;
    if (meterType) where.meterType = meterType;
    if (leaseId) where.leaseId = leaseId;

    ok(
      res,
      await prisma.meterReading.findMany({
        where,
        include: {
          room: true,
          lease: true,
          meter: true,
          createdBy: { select: { id: true, username: true, phone: true } },
        },
        orderBy: { readingDate: 'desc' },
      })
    );
  })
);

meterReadingRouter.post(
  '/',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        roomId: z.string(),
        meterId: z.string().optional(),
        meterType: z.enum(['WATER', 'POWER', 'GAS']),
        readingDate: z.coerce.date(),
        value: z.coerce.number().nonnegative(),
        source: z.enum(['MANUAL', 'IMPORT']).default('MANUAL'),
        readType: z
          .enum(['MANUAL', 'SMART', 'CHECKIN', 'CHECKOUT'])
          .default('MANUAL'),
        note: z.string().optional(),
      })
      .parse(req.body);

    const room = await prisma.room.findFirst({
      where: {
        id: input.roomId,
        apartment: { organizationId: req.organizationId! },
      },
      include: { apartment: true },
    });
    if (!room) throw new HttpError(404, '房间不存在');

    const lease = await prisma.lease.findFirst({
      where: {
        roomId: room.id,
        organizationId: req.organizationId!,
        startDate: { lte: input.readingDate },
        endDate: { gte: input.readingDate },
      },
      orderBy: { startDate: 'desc' },
    });

    const lastReading = await prisma.meterReading.findFirst({
      where: {
        roomId: room.id,
        meterType: input.meterType,
        status: { not: 'VOID' },
      },
      orderBy: { readingDate: 'desc' },
    });

    const usage = lastReading
      ? Number(input.value) - Number(lastReading.value)
      : 0;
    const isAbnormal =
      input.source === 'MANUAL' && usage > 0
        ? await detectAbnormalUsage(room.id, input.meterType, usage)
        : false;

    const reading = await prisma.meterReading.create({
      data: {
        organizationId: req.organizationId!,
        apartmentId: room.apartmentId,
        roomId: room.id,
        leaseId: lease?.id,
        meterId: input.meterId,
        meterType: input.meterType,
        readingDate: input.readingDate,
        value: input.value,
        usage,
        source: input.source,
        readType: input.readType,
        status: isAbnormal ? 'SUSPECTED' : 'NORMAL',
        note: isAbnormal
          ? [input.note, '系统标记：用量异常'].filter(Boolean).join('；')
          : input.note,
        createdById: req.user!.id,
      },
    });

    ok(res, reading);
  })
);

meterReadingRouter.post(
  '/batch-import',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        rows: z.array(
          z.object({
            roomId: z.string(),
            meterType: z.enum(['WATER', 'POWER', 'GAS']),
            readingDate: z.coerce.date(),
            value: z.coerce.number().nonnegative(),
            note: z.string().optional(),
          })
        ),
      })
      .parse(req.body);

    const results = [];
    for (const row of input.rows) {
      const room = await prisma.room.findFirst({
        where: {
          id: row.roomId,
          apartment: { organizationId: req.organizationId! },
        },
        include: { apartment: true },
      });
      if (!room) continue;

      const lastReading = await prisma.meterReading.findFirst({
        where: {
          roomId: room.id,
          meterType: row.meterType,
          status: { not: 'VOID' },
        },
        orderBy: { readingDate: 'desc' },
      });

      const usage = lastReading
        ? Number(row.value) - Number(lastReading.value)
        : 0;
      const isAbnormal =
        usage > 0
          ? await detectAbnormalUsage(room.id, row.meterType, usage)
          : false;

      const reading = await prisma.meterReading.create({
        data: {
          organizationId: req.organizationId!,
          apartmentId: room.apartmentId,
          roomId: room.id,
          meterType: row.meterType,
          readingDate: row.readingDate,
          value: row.value,
          usage,
          source: 'IMPORT',
          status: isAbnormal ? 'SUSPECTED' : 'NORMAL',
          note: isAbnormal
            ? [row.note, '系统标记：用量异常'].filter(Boolean).join('；')
            : row.note,
          createdById: req.user!.id,
        },
      });
      results.push(reading);
    }

    ok(res, { imported: results.length, items: results });
  })
);

meterReadingRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const reading = await prisma.meterReading.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      include: {
        room: true,
        lease: true,
        meter: true,
        createdBy: { select: { id: true, username: true } },
      },
    });
    if (!reading) throw new HttpError(404, '抄表记录不存在');
    ok(res, reading);
  })
);

meterReadingRouter.put(
  '/:id',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        value: z.coerce.number().nonnegative().optional(),
        note: z.string().optional(),
        status: z.enum(['NORMAL', 'SUSPECTED', 'CONFIRMED', 'VOID']).optional(),
      })
      .parse(req.body);

    const reading = await prisma.meterReading.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!reading) throw new HttpError(404, '抄表记录不存在');

    ok(
      res,
      await prisma.meterReading.update({
        where: { id: req.params.id },
        data: input,
      })
    );
  })
);

meterReadingRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const reading = await prisma.meterReading.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!reading) throw new HttpError(404, '抄表记录不存在');

    await prisma.meterReading.softDelete({ where: { id: req.params.id } });
    ok(res, { deleted: true });
  })
);

meterReadingRouter.post(
  '/calculate',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        previousWater: z.coerce.number(),
        currentWater: z.coerce.number(),
        waterUnitPrice: z.coerce.number(),
        previousPower: z.coerce.number(),
        currentPower: z.coerce.number(),
        powerUnitPrice: z.coerce.number(),
        previousGas: z.coerce.number().optional(),
        currentGas: z.coerce.number().optional(),
        gasUnitPrice: z.coerce.number().optional(),
      })
      .parse(req.body);

    const { waterAmount, powerAmount } = calculateUtilityLineAmounts({
      previousWater: input.previousWater,
      currentWater: input.currentWater,
      waterUnitPrice: input.waterUnitPrice,
      previousPower: input.previousPower,
      currentPower: input.currentPower,
      powerUnitPrice: input.powerUnitPrice,
    });

    const waterAmt = Number(waterAmount);
    const powerAmt = Number(powerAmount);

    let gasAmount = 0;
    if (
      input.previousGas !== undefined &&
      input.currentGas !== undefined &&
      input.gasUnitPrice !== undefined
    ) {
      gasAmount = (input.currentGas - input.previousGas) * input.gasUnitPrice;
    }

    ok(res, {
      water: {
        usage: input.currentWater - input.previousWater,
        amount: waterAmt,
      },
      power: {
        usage: input.currentPower - input.previousPower,
        amount: powerAmt,
      },
      gas: input.gasUnitPrice
        ? {
            usage: (input.currentGas ?? 0) - (input.previousGas ?? 0),
            amount: gasAmount,
          }
        : undefined,
      total: waterAmt + powerAmt + gasAmount,
    });
  })
);
