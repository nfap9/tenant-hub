import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth, requireOrg, requirePermission } from "../middleware/auth.js";
import { generateLeaseBills } from "../services/billing.js";
import { PERMISSIONS } from "../services/roles.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/http.js";

export const leaseRouter = Router();
leaseRouter.use(requireAuth, requireOrg);

leaseRouter.get(
  "/",
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    ok(
      res,
      await prisma.lease.findMany({
        where: { organizationId: req.organizationId! },
        include: { room: { include: { apartment: true } }, fees: true },
        orderBy: { createdAt: "desc" }
      })
    );
  })
);

leaseRouter.post(
  "/",
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        roomId: z.string(),
        tenantName: z.string().min(1),
        tenantPhone: z.string().min(6),
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        graceDays: z.coerce.number().int().min(0).default(0),
        cycle: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]),
        rentAmount: z.coerce.number(),
        depositAmount: z.coerce.number().default(0),
        waterUnitPrice: z.coerce.number(),
        powerUnitPrice: z.coerce.number(),
        autoRenew: z.boolean().default(false),
        fees: z.array(z.object({ feeItemId: z.string().optional(), name: z.string(), amount: z.coerce.number() })).default([])
      })
      .parse(req.body);

    const { fees, roomId, ...leaseData } = input;
    const lease = await prisma.lease.create({
      data: {
        ...leaseData,
        organizationId: req.organizationId!,
        roomId,
        fees: { create: fees }
      }
    });
    await prisma.room.update({ where: { id: roomId }, data: { status: "OCCUPIED" } });
    await generateLeaseBills(lease.id);
    ok(res, lease);
  })
);

leaseRouter.post(
  "/:id/terminate",
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({ type: z.enum(["EXPIRED", "NEGOTIATED", "BREACH"]), reason: z.string().optional(), terminatedAt: z.coerce.date().default(new Date()) })
      .parse(req.body);
    const lease = await prisma.lease.update({
      where: { id: req.params.id },
      data: { status: "TERMINATED", terminationType: input.type, terminationReason: input.reason, terminatedAt: input.terminatedAt }
    });
    await prisma.room.update({ where: { id: lease.roomId }, data: { status: "VACANT" } });
    ok(res, lease);
  })
);
