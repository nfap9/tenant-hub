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

export const landlordContractRouter = Router();
landlordContractRouter.use(requireAuth, requireOrg);

const contractInput = z.object({
  apartmentId: z.string(),
  contractNo: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  rentAmount: z.coerce.number().nonnegative(),
  depositAmount: z.coerce.number().nonnegative().default(0),
  paymentMethod: z.string(),
  escalationType: z.string().optional(),
  escalationValue: z.coerce.number().optional(),
  escalationCycle: z.coerce.number().int().optional(),
  freeRentDays: z.coerce.number().int().min(0).default(0),
  freeRentStart: z.coerce.date().optional(),
  freeRentEnd: z.coerce.date().optional(),
  signDate: z.coerce.date().optional(),
  attachmentUrl: z.string().optional(),
  note: z.string().optional(),
});

landlordContractRouter.get(
  '/',
  requirePermission(PERMISSIONS.APARTMENT_VIEW),
  asyncHandler(async (req, res) => {
    const apartmentId = z.string().optional().parse(req.query.apartmentId);
    const contracts = await prisma.landlordContract.findMany({
      where: {
        apartment: { organizationId: req.organizationId! },
        deletedAt: null,
        ...(apartmentId ? { apartmentId } : {}),
      },
      include: { apartment: true },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, contracts);
  })
);

landlordContractRouter.post(
  '/',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = contractInput.parse(req.body);
    const apartment = await prisma.apartment.findFirst({
      where: { id: input.apartmentId, organizationId: req.organizationId! },
    });
    if (!apartment) throw new HttpError(404, '公寓不存在');
    ok(
      res,
      await prisma.landlordContract.create({
        data: input,
        include: { apartment: true },
      })
    );
  })
);

landlordContractRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.APARTMENT_VIEW),
  asyncHandler(async (req, res) => {
    const contract = await prisma.landlordContract.findFirst({
      where: {
        id: req.params.id,
        apartment: { organizationId: req.organizationId! },
        deletedAt: null,
      },
      include: { apartment: true },
    });
    if (!contract) throw new HttpError(404, '合同不存在');
    ok(res, contract);
  })
);

landlordContractRouter.put(
  '/:id',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = contractInput.partial().parse(req.body);
    const contract = await prisma.landlordContract.findFirst({
      where: {
        id: req.params.id,
        apartment: { organizationId: req.organizationId! },
        deletedAt: null,
      },
    });
    if (!contract) throw new HttpError(404, '合同不存在');
    ok(
      res,
      await prisma.landlordContract.update({
        where: { id: req.params.id },
        data: input,
        include: { apartment: true },
      })
    );
  })
);

landlordContractRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const contract = await prisma.landlordContract.findFirst({
      where: {
        id: req.params.id,
        apartment: { organizationId: req.organizationId! },
        deletedAt: null,
      },
    });
    if (!contract) throw new HttpError(404, '合同不存在');
    await prisma.landlordContract.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    ok(res, { deleted: true });
  })
);
