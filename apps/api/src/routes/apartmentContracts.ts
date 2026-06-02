import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, ok } from '../utils/http.js';
import { PERMISSIONS } from '../services/roles.js';

export const apartmentContractRouter = Router();
apartmentContractRouter.use(requireAuth, requireOrg);

const contractInput = z.object({
  landlordName: z.string().optional(),
  landlordPhone: z.string().optional(),
  contractStart: z.coerce.date().optional(),
  contractEnd: z.coerce.date().optional(),
  rentAmount: z.coerce.number().optional(),
  floors: z.coerce.number().int().min(1).optional(),
  landArea: z.coerce.number().optional(),
  totalArea: z.coerce.number().optional(),
});

const ensureApartmentInOrg = async (
  apartmentId: string,
  organizationId: string
) => {
  const apartment = await prisma.apartment.findFirst({
    where: { id: apartmentId, organizationId },
    select: { id: true },
  });
  if (!apartment) throw new HttpError(404, '公寓不存在');
};

apartmentContractRouter.get(
  '/:id/contract',
  requirePermission(PERMISSIONS.APARTMENT_VIEW),
  asyncHandler(async (req, res) => {
    await ensureApartmentInOrg(req.params.id, req.organizationId!);
    const contract = await prisma.apartmentContract.findUnique({
      where: { apartmentId: req.params.id },
    });
    ok(res, contract);
  })
);

apartmentContractRouter.post(
  '/:id/contract',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = contractInput.parse(req.body);
    await ensureApartmentInOrg(req.params.id, req.organizationId!);

    const existing = await prisma.apartmentContract.findUnique({
      where: { apartmentId: req.params.id },
    });
    if (existing) throw new HttpError(409, '该公寓已存在上游合同');

    ok(
      res,
      await prisma.apartmentContract.create({
        data: {
          ...input,
          apartmentId: req.params.id,
          organizationId: req.organizationId!,
        },
      })
    );
  })
);

apartmentContractRouter.put(
  '/:id/contract',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const input = contractInput.partial().parse(req.body);
    await ensureApartmentInOrg(req.params.id, req.organizationId!);

    const existing = await prisma.apartmentContract.findUnique({
      where: { apartmentId: req.params.id },
    });
    if (!existing) throw new HttpError(404, '上游合同不存在');

    ok(
      res,
      await prisma.apartmentContract.update({
        where: { apartmentId: req.params.id },
        data: input,
      })
    );
  })
);

apartmentContractRouter.delete(
  '/:id/contract',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    await ensureApartmentInOrg(req.params.id, req.organizationId!);

    const existing = await prisma.apartmentContract.findUnique({
      where: { apartmentId: req.params.id },
    });
    if (!existing) throw new HttpError(404, '上游合同不存在');

    ok(
      res,
      await prisma.apartmentContract.delete({
        where: { apartmentId: req.params.id },
      })
    );
  })
);
