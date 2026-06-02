import { Router } from 'express';
import { z } from 'zod';
import { basePrisma, prisma } from '../prisma/client.js';
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from '../middleware/auth.js';
import { PERMISSIONS } from '../services/roles.js';
import { enforceOrganizationQuota } from '../services/quotas.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, ok } from '../utils/http.js';

export const roomRouter = Router();
roomRouter.use(requireAuth, requireOrg);

roomRouter.post(
  '/',
  requirePermission(PERMISSIONS.ROOM_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        apartmentId: z.string(),
        roomNo: z.string().min(1),
        floor: z.coerce.number().int().min(1).optional(),
        layout: z.string().min(1),
        area: z.coerce.number().optional(),
        orientation: z
          .enum([
            'NORTH',
            'SOUTH',
            'EAST',
            'WEST',
            'NORTH_EAST',
            'NORTH_WEST',
            'SOUTH_EAST',
            'SOUTH_WEST',
          ])
          .optional(),
        decorationStatus: z
          .enum(['BARE', 'SIMPLE', 'DELUXE', 'LUXURY'])
          .optional(),
        decorationDate: z.coerce.date().optional(),
        facilities: z.array(z.string()).default([]),
      })
      .parse(req.body);

    const apartment = await prisma.apartment.findFirst({
      where: {
        id: input.apartmentId,
        organizationId: req.organizationId!,
        deletedAt: null,
      },
    });
    if (!apartment) throw new HttpError(404, '公寓不存在');

    ok(
      res,
      await basePrisma.$transaction(async (tx) => {
        await enforceOrganizationQuota(
          tx,
          req.organizationId!,
          'room',
          async () => {
            const roomCount = await tx.room.count({
              where: { apartment: { organizationId: req.organizationId! } },
            });
            return roomCount + 1;
          }
        );
        return tx.room.create({
          data: {
            ...input,
            apartmentId: input.apartmentId,
          },
        });
      })
    );
  })
);
