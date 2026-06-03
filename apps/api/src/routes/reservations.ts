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

export const reservationRouter = Router();
reservationRouter.use(requireAuth, requireOrg);

reservationRouter.post(
  '/',
  requirePermission(PERMISSIONS.ROOM_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        roomId: z.string(),
        name: z.string().min(1),
        phone: z.string().min(6),
        deposit: z.coerce.number().default(0),
        paymentMethod: z.string().optional(),
        expectedMoveInDate: z.coerce.date(),
      })
      .parse(req.body);

    const room = await prisma.room.findFirst({
      where: {
        id: input.roomId,
        apartment: { organizationId: req.organizationId! },
      },
      select: { id: true, status: true },
    });
    if (!room) throw new HttpError(404, '房间不存在');
    if (room.status !== 'VACANT' && room.status !== 'RESERVED')
      throw new HttpError(400, '仅空闲或已预留的房间可以预留');

    const existing = await prisma.reservation.findUnique({
      where: { roomId: input.roomId },
    });

    const reservation = await prisma.$transaction(async (tx) => {
      const data = {
        name: input.name,
        phone: input.phone,
        deposit: input.deposit,
        paymentMethod: input.deposit > 0 ? input.paymentMethod || null : null,
        expectedMoveInDate: input.expectedMoveInDate,
      };

      if (existing) {
        await tx.reservation.update({
          where: { roomId: input.roomId },
          data,
        });
      } else {
        await tx.reservation.create({
          data: { roomId: input.roomId, ...data },
        });
      }

      if (room.status !== 'RESERVED') {
        await tx.room.update({
          where: { id: input.roomId },
          data: { status: 'RESERVED' },
        });
      }

      return tx.reservation.findUniqueOrThrow({
        where: { roomId: input.roomId },
        include: { room: true },
      });
    });

    ok(res, reservation);
  })
);

reservationRouter.delete(
  '/:roomId',
  requirePermission(PERMISSIONS.ROOM_MANAGE),
  asyncHandler(async (req, res) => {
    const room = await prisma.room.findFirst({
      where: {
        id: req.params.roomId,
        apartment: { organizationId: req.organizationId! },
      },
      select: { id: true, status: true },
    });
    if (!room) throw new HttpError(404, '房间不存在');

    const reservation = await prisma.reservation.findUnique({
      where: { roomId: req.params.roomId },
    });
    if (!reservation) throw new HttpError(404, '预留信息不存在');

    await prisma.$transaction([
      prisma.reservation.delete({ where: { roomId: req.params.roomId } }),
      prisma.room.update({
        where: { id: req.params.roomId },
        data: { status: 'VACANT' },
      }),
    ]);

    ok(res, { deleted: true });
  })
);

reservationRouter.get(
  '/:roomId',
  requirePermission(PERMISSIONS.ROOM_VIEW),
  asyncHandler(async (req, res) => {
    const reservation = await prisma.reservation.findUnique({
      where: { roomId: req.params.roomId },
    });
    ok(res, reservation ?? {});
  })
);
