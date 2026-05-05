import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth, requireOrg, requirePermission } from "../middleware/auth.js";
import { generateLeaseBills, recordMonthlyBillPayment, refreshBillTotals, retryPostpaidBillAndMonthlyBill } from "../services/billing.js";
import { PERMISSIONS } from "../services/roles.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError, ok } from "../utils/http.js";

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

billRouter.get(
  "/monthly",
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const status = z.enum(["DRAFT", "BILLING", "UNPAID", "PARTIAL_PAID", "PAID", "FAILED", "VOID"]).optional().parse(req.query.status);
    ok(
      res,
      await prisma.monthlyBill.findMany({
        where: { organizationId: req.organizationId!, ...(status ? { status } : {}) },
        include: { lease: { include: { room: true } }, bills: { include: { items: true } }, payments: true },
        orderBy: { billingDate: "desc" }
      })
    );
  })
);

billRouter.post(
  "/generate",
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z.object({ leaseId: z.string(), today: z.coerce.date().optional() }).parse(req.body);
    const lease = await prisma.lease.findFirst({ where: { id: input.leaseId, organizationId: req.organizationId! }, select: { id: true } });
    if (!lease) throw new HttpError(404, "租约不存在");
    ok(res, { billIds: await generateLeaseBills(input.leaseId, input.today ?? new Date()) });
  })
);

billRouter.get(
  "/meter-readings",
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const roomId = z.string().optional().parse(req.query.roomId);
    ok(
      res,
      await prisma.meterReading.findMany({
        where: { organizationId: req.organizationId!, ...(roomId ? { roomId } : {}) },
        include: { room: true, lease: true, createdBy: { select: { id: true, username: true, phone: true } } },
        orderBy: { readingDate: "desc" }
      })
    );
  })
);

billRouter.post(
  "/meter-readings",
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        roomId: z.string(),
        meterType: z.enum(["WATER", "POWER"]),
        readingDate: z.coerce.date(),
        value: z.coerce.number().nonnegative(),
        source: z.enum(["MANUAL", "IMPORT"]).default("MANUAL"),
        status: z.enum(["NORMAL", "SUSPECTED", "CONFIRMED", "VOID"]).default("NORMAL"),
        note: z.string().optional()
      })
      .parse(req.body);
    const room = await prisma.room.findFirst({ where: { id: input.roomId, apartment: { organizationId: req.organizationId! } }, include: { apartment: true } });
    if (!room) throw new HttpError(404, "房间不存在");
    const lease = await prisma.lease.findFirst({
      where: {
        roomId: room.id,
        organizationId: req.organizationId!,
        startDate: { lte: input.readingDate },
        endDate: { gte: input.readingDate }
      },
      orderBy: { startDate: "desc" }
    });

    ok(
      res,
      await prisma.meterReading.create({
        data: {
          organizationId: req.organizationId!,
          apartmentId: room.apartmentId,
          roomId: room.id,
          leaseId: lease?.id,
          meterType: input.meterType,
          readingDate: input.readingDate,
          value: input.value,
          source: input.source,
          status: input.status,
          note: input.note,
          createdById: req.user!.id
        }
      })
    );
  })
);

billRouter.post(
  "/monthly/:id/payments",
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z.object({ amount: z.coerce.number().positive(), method: z.string().min(1), note: z.string().optional() }).parse(req.body);
    const monthlyBill = await prisma.monthlyBill.findFirst({ where: { id: req.params.id, organizationId: req.organizationId! } });
    if (!monthlyBill) throw new HttpError(404, "月度账单不存在");
    ok(res, await recordMonthlyBillPayment({ monthlyBillId: monthlyBill.id, userId: req.user!.id, ...input }));
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
    const bills = await prisma.bill.findMany({
      where: { mode: "POSTPAID", status: { in: ["BILLING", "FAILED"] }, organizationId: req.organizationId! },
      include: { lease: { include: { room: true } }, items: true },
      orderBy: { billingDate: "asc" }
    });
    res.setHeader("content-type", "text/csv; charset=utf-8");
    res.send(
      ["billId,房间号,租客,交租日,水电周期开始,水电周期结束,上月水表,本月水表,上月电表,本月电表,失败原因"]
        .concat(
          bills.map(
            (bill) =>
              `${bill.id},${bill.lease.room.roomNo},${bill.lease.tenantName},${bill.billingDate.toISOString()},${bill.periodStart.toISOString()},${bill.periodEnd.toISOString()},,,,,${bill.failureReason ?? ""}`
          )
        )
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
  "/:id/retry-billing",
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const bill = await prisma.bill.findFirst({ where: { id: req.params.id, organizationId: req.organizationId! } });
    if (!bill) throw new HttpError(404, "账单不存在");
    if (bill.mode !== "POSTPAID") throw new HttpError(400, "仅后付费账单需要重新出账");
    ok(res, await retryPostpaidBillAndMonthlyBill(bill.id));
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
