import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth, requireOrg, requirePermission } from "../middleware/auth.js";
import { refreshBillTotals } from "../services/billing.js";
import { PERMISSIONS } from "../services/roles.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/http.js";

export const billRouter = Router();
billRouter.use(requireAuth, requireOrg);

billRouter.get(
  "/",
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const status = z.enum(["DRAFT", "BILLING", "UNPAID", "PARTIAL_PAID", "PAID", "FAILED", "VOID"]).optional().parse(req.query.status);
    ok(
      res,
      await prisma.bill.findMany({
        where: { organizationId: req.organizationId!, ...(status ? { status } : {}) },
        include: { lease: { include: { room: true } }, items: true, payments: true },
        orderBy: { dueDate: "asc" }
      })
    );
  })
);

billRouter.post(
  "/items/:itemId/utility-reading",
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        previousWater: z.coerce.number(),
        currentWater: z.coerce.number(),
        previousPower: z.coerce.number(),
        currentPower: z.coerce.number()
      })
      .parse(req.body);
    const item = await prisma.billItem.findUniqueOrThrow({ where: { id: req.params.itemId } });
    const waterUnitPrice = new Prisma.Decimal(item.waterUnitPrice ?? 0);
    const powerUnitPrice = new Prisma.Decimal(item.powerUnitPrice ?? 0);
    const amount = new Prisma.Decimal(input.currentWater)
      .minus(input.previousWater)
      .mul(waterUnitPrice)
      .plus(new Prisma.Decimal(input.currentPower).minus(input.previousPower).mul(powerUnitPrice));

    const updated = await prisma.billItem.update({
      where: { id: item.id },
      data: { ...input, amount, status: "UNPAID" }
    });
    await refreshBillTotals(item.billId);
    ok(res, updated);
  })
);

billRouter.get(
  "/utility/pending-export",
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const items = await prisma.billItem.findMany({
      where: { type: "UTILITY", status: "BILLING", bill: { organizationId: req.organizationId! } },
      include: { bill: { include: { lease: { include: { room: true } } } } }
    });
    res.setHeader("content-type", "text/csv; charset=utf-8");
    res.send(
      ["itemId,房间号,租客,上月水表,本月水表,上月电表,本月电表"]
        .concat(items.map((item) => `${item.id},${item.bill.lease.room.roomNo},${item.bill.lease.tenantName},,,,`))
        .join("\n")
    );
  })
);

billRouter.post(
  "/utility/import",
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        rows: z.array(
          z.object({
            itemId: z.string(),
            previousWater: z.coerce.number(),
            currentWater: z.coerce.number(),
            previousPower: z.coerce.number(),
            currentPower: z.coerce.number()
          })
        )
      })
      .parse(req.body);
    const results = [];
    for (const row of input.rows) {
      const item = await prisma.billItem.findUniqueOrThrow({ where: { id: row.itemId } });
      const amount = new Prisma.Decimal(row.currentWater)
        .minus(row.previousWater)
        .mul(item.waterUnitPrice ?? 0)
        .plus(new Prisma.Decimal(row.currentPower).minus(row.previousPower).mul(item.powerUnitPrice ?? 0));
      results.push(await prisma.billItem.update({ where: { id: item.id }, data: { ...row, amount, status: "UNPAID" } }));
      await refreshBillTotals(item.billId);
    }
    ok(res, results);
  })
);

billRouter.post(
  "/:id/payments",
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z.object({ amount: z.coerce.number(), method: z.string().min(1), note: z.string().optional() }).parse(req.body);
    const payment = await prisma.payment.create({ data: { ...input, billId: req.params.id, userId: req.user!.id } });
    await refreshBillTotals(req.params.id);
    ok(res, payment);
  })
);
