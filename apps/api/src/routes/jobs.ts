import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma/client.js';
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from '../middleware/auth.js';
import {
  generateCurrentLeaseBills,
  generateLeaseBills,
} from '../services/billing.js';
import { calculateOverduePenalties } from '../services/overdue.js';
import { PERMISSIONS } from '../services/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, ok } from '../utils/http.js';

export const jobRouter = Router();
jobRouter.use(requireAuth, requireOrg);

jobRouter.get(
  '/status',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const pendingCount = await prisma.billQueue.count({
      where: {
        status: { in: ['PENDING', 'PROCESSING', 'FAILED'] },
        lease: { organizationId: req.organizationId! },
      },
    });
    ok(res, { pendingCount });
  })
);

jobRouter.post(
  '/bill-generation',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        leaseId: z.string().optional(),
        today: z.coerce.date().optional(),
      })
      .parse(req.body);

    if (!input.leaseId) {
      ok(
        res,
        await generateCurrentLeaseBills(
          req.organizationId!,
          input.today ?? new Date()
        )
      );
      return;
    }

    const lease = await prisma.lease.findFirst({
      where: { id: input.leaseId, organizationId: req.organizationId! },
    });
    if (!lease) throw new HttpError(404, '租约不存在');

    ok(res, {
      billIds: await generateLeaseBills(
        input.leaseId,
        input.today ?? new Date()
      ),
    });
  })
);

jobRouter.post(
  '/late-fee-calculation',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (_req, res) => {
    const calculatedCount = await calculateOverduePenalties();

    ok(res, { calculatedCount });
  })
);

jobRouter.post(
  '/lease-expiry-check',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const expiringLeases = await prisma.lease.findMany({
      where: {
        organizationId: req.organizationId!,
        status: 'ACTIVE',
        endDate: { lte: in30Days, gte: now },
      },
    });

    let updatedCount = 0;
    for (const lease of expiringLeases) {
      if (lease.autoRenew) {
        // Auto-renew logic would go here
      } else {
        await prisma.lease.update({
          where: { id: lease.id },
          data: { status: 'EXPIRING_SOON' },
        });
        updatedCount++;
      }
    }

    ok(res, { expiringCount: expiringLeases.length, updatedCount });
  })
);

jobRouter.post(
  '/contract-reminder',
  requirePermission(PERMISSIONS.APARTMENT_MANAGE),
  asyncHandler(async (req, res) => {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const contracts = await prisma.landlordContract.findMany({
      where: {
        apartment: { organizationId: req.organizationId! },
        endDate: { lte: in30Days, gte: now },
        deletedAt: null,
      },
      include: { apartment: true },
    });

    const reminders = contracts.map((c) => ({
      contractId: c.id,
      apartmentName: c.apartment.name,
      daysUntilExpiry: Math.ceil(
        (c.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      ),
      urgency: c.endDate <= in7Days ? 'HIGH' : 'MEDIUM',
    }));

    ok(res, { reminders });
  })
);
