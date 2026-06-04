import { Router } from 'express';
import { z } from 'zod';
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from '../middleware/auth.js';
import { PERMISSIONS } from '../services/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, ok } from '../utils/http.js';
import {
  findRoomForReservation,
  upsertReservation,
  deleteReservation,
  getReservationByRoomId,
} from '../services/reservation.js';

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

    const room = await findRoomForReservation(
      input.roomId,
      req.organizationId!
    );
    if (!room) throw new HttpError(404, '房间不存在');
    if (room.status !== 'VACANT' && room.status !== 'RESERVED')
      throw new HttpError(400, '仅空闲或已预留的房间可以预留');

    const reservation = await upsertReservation({
      roomId: input.roomId,
      name: input.name,
      phone: input.phone,
      deposit: input.deposit,
      paymentMethod: input.paymentMethod,
      expectedMoveInDate: input.expectedMoveInDate,
      organizationId: req.organizationId!,
      userId: req.user!.id,
      roomStatus: room.status,
      apartmentId: room.apartmentId,
      roomNo: room.roomNo,
      apartmentName: room.apartment.name,
    });

    ok(res, reservation);
  })
);

reservationRouter.delete(
  '/:roomId',
  requirePermission(PERMISSIONS.ROOM_MANAGE),
  asyncHandler(async (req, res) => {
    const room = await findRoomForReservation(
      req.params.roomId,
      req.organizationId!
    );
    if (!room) throw new HttpError(404, '房间不存在');

    const reservation = await getReservationByRoomId(req.params.roomId);
    if (!reservation) throw new HttpError(404, '预留信息不存在');

    await deleteReservation(req.params.roomId);

    ok(res, { deleted: true });
  })
);

reservationRouter.get(
  '/:roomId',
  requirePermission(PERMISSIONS.ROOM_VIEW),
  asyncHandler(async (req, res) => {
    const reservation = await getReservationByRoomId(req.params.roomId);
    ok(res, reservation ?? {});
  })
);
