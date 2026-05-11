import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth, requireOrg, requirePermission } from "../middleware/auth.js";
import { generateLeaseBills } from "../services/billing.js";
import { assertExpiredTerminationAllowed, startOfLeaseDay, withLeaseLifecycle } from "../services/leaseLifecycle.js";
import { createLeaseSettlement, getLeaseSettlementPreview, recordSettlementPayment } from "../services/leaseSettlement.js";
import { PERMISSIONS } from "../services/roles.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError, ok } from "../utils/http.js";

export const leaseRouter = Router();
leaseRouter.use(requireAuth, requireOrg);

const leaseInclude = { room: { include: { apartment: true } }, fees: true } as const;
const amountSchema = z.coerce.number().nonnegative();
const feeItemTypeSchema = z.enum(["MANAGEMENT", "SANITATION", "ELEVATOR", "PROPERTY", "NETWORK", "OTHER"]).default("OTHER");

leaseRouter.get(
  "/",
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    ok(
      res,
      (
        await prisma.lease.findMany({
          where: { organizationId: req.organizationId! },
          include: leaseInclude,
          orderBy: { createdAt: "desc" }
        })
      ).map((lease) => withLeaseLifecycle(lease))
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
        rentAmount: amountSchema,
        depositAmount: amountSchema.default(0),
        waterUnitPrice: amountSchema,
        powerUnitPrice: amountSchema,
        autoRenew: z.boolean().default(false),
        fees: z.array(z.object({ type: feeItemTypeSchema, name: z.string().min(1), amount: amountSchema })).default([]),
        generateHistoricalBills: z.boolean().default(false)
      })
      .refine((data) => data.endDate >= data.startDate, { path: ["endDate"], message: "租约结束日期不能早于开始日期" })
      .parse(req.body);

    const { fees, roomId, generateHistoricalBills, ...leaseData } = input;
    const room = await prisma.room.findFirst({
      where: { id: roomId, apartment: { organizationId: req.organizationId! } },
      select: { id: true, status: true }
    });
    if (!room) throw new HttpError(404, "房间不存在");
    if (room.status !== "VACANT") throw new HttpError(400, "仅空闲房间可以签约");

    const lease = await prisma.lease.create({
      data: {
        ...leaseData,
        organizationId: req.organizationId!,
        roomId,
        fees: { create: fees }
      },
      include: leaseInclude
    });
    await prisma.room.update({ where: { id: roomId }, data: { status: "OCCUPIED" } });
    const isHistorical = startOfLeaseDay(input.startDate).isBefore(startOfLeaseDay(new Date()), "day");
    await generateLeaseBills(lease.id, new Date(), { onlyCurrentPeriod: isHistorical && !generateHistoricalBills });
    ok(res, withLeaseLifecycle(lease));
  })
);

leaseRouter.put(
  "/:id",
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        rentAmount: amountSchema.optional(),
        depositAmount: amountSchema.optional(),
        waterUnitPrice: amountSchema.optional(),
        powerUnitPrice: amountSchema.optional(),
        fees: z.array(z.object({ type: feeItemTypeSchema, name: z.string().min(1), amount: amountSchema })).optional()
      })
      .parse(req.body);

    const lease = await prisma.lease.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      include: { fees: true }
    });
    if (!lease) throw new HttpError(404, "租约不存在");
    if (lease.status !== "ACTIVE") throw new HttpError(400, "仅有效租约可以变更");

    const { fees, ...leaseData } = input;
    const updated = await prisma.$transaction(async (tx) => {
      if (fees) {
        await tx.leaseFee.deleteMany({ where: { leaseId: lease.id } });
        await tx.leaseFee.createMany({ data: fees.map((fee) => ({ ...fee, leaseId: lease.id })) });
      }
      return tx.lease.update({
        where: { id: lease.id },
        data: leaseData,
        include: leaseInclude
      });
    });

    ok(res, withLeaseLifecycle(updated));
  })
);

leaseRouter.post(
  "/:id/terminate",
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        type: z.enum(["EXPIRED", "NEGOTIATED", "BREACH"]),
        reason: z.string().optional(),
        terminatedAt: z.coerce.date().default(new Date()),
        depositDeductionAmount: amountSchema.default(0),
        depositDeductionReason: z.string().optional(),
        rentAdjustmentAmount: z.coerce.number().default(0),
        currentWater: amountSchema,
        currentPower: amountSchema,
        otherFeeAmount: amountSchema.default(0),
        otherFeeReason: z.string().optional()
      })
      .parse(req.body);
    const current = await prisma.lease.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      select: { id: true, endDate: true }
    });
    if (!current) throw new HttpError(404, "租约不存在");
    if (input.type === "EXPIRED") {
      try {
        assertExpiredTerminationAllowed(current.endDate, input.terminatedAt);
      } catch (error) {
        throw new HttpError(400, error instanceof Error ? error.message : "到期解约的退租日期不能早于原租约结束日期");
      }
    }
    const settlement = await createLeaseSettlement({
      leaseId: req.params.id,
      organizationId: req.organizationId!,
      userId: req.user!.id,
      input
    });
    ok(res, settlement);
  })
);

leaseRouter.get(
  "/:id/settlement-preview",
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    const terminatedAt = z.coerce.date().default(new Date()).parse(req.query.terminatedAt);
    ok(res, await getLeaseSettlementPreview({ leaseId: req.params.id, organizationId: req.organizationId!, terminatedAt }));
  })
);

leaseRouter.get(
  "/settlements",
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    ok(
      res,
      await prisma.leaseSettlement.findMany({
        where: { organizationId: req.organizationId! },
        include: { lease: { include: leaseInclude }, room: true, payments: { include: { user: { select: { id: true, username: true, phone: true } } } } },
        orderBy: { createdAt: "desc" }
      })
    );
  })
);

leaseRouter.post(
  "/settlements/:id/payments",
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        direction: z.enum(["RECEIVE", "REFUND"]),
        amount: z.coerce.number().positive(),
        method: z.string().min(1),
        note: z.string().optional()
      })
      .parse(req.body);
    ok(
      res,
      await recordSettlementPayment({
        settlementId: req.params.id,
        organizationId: req.organizationId!,
        userId: req.user!.id,
        ...input
      })
    );
  })
);
