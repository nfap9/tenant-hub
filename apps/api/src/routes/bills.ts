import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { requireAuth, requireOrg, requirePermission } from "../middleware/auth.js";
import {
  calculateUtilityLineAmounts,
  generateCurrentLeaseBills,
  generateLeaseBills,
  recordBillPayment,
  recordMonthlyBillPayment,
  refreshBillTotals,
  retryPostpaidBillAndMonthlyBill
} from "../services/billing.js";
import { toCsv } from "../services/csv.js";
import { PERMISSIONS } from "../services/roles.js";
import { parseUtilityImportRows } from "../services/utilityImport.js";
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
    const input = z.object({ leaseId: z.string().optional(), today: z.coerce.date().optional() }).parse(req.body);
    if (!input.leaseId) {
      ok(res, await generateCurrentLeaseBills(req.organizationId!, input.today ?? new Date()));
      return;
    }
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

const applyUtilityReadingToBill = async ({
  billId,
  organizationId,
  previousWater,
  currentWater,
  previousPower,
  currentPower
}: {
  billId: string;
  organizationId: string;
  previousWater: number;
  currentWater: number;
  previousPower: number;
  currentPower: number;
}) => {
  const bill = await prisma.bill.findFirst({
    where: { id: billId, organizationId },
    include: { items: true }
  });
  if (!bill) throw new HttpError(404, "账单不存在");
  if (bill.mode !== "POSTPAID") throw new HttpError(400, "仅后付费水电账单可以录入读数");

  const waterItem = bill.items.find((item) => item.type === "WATER");
  const powerItem = bill.items.find((item) => item.type === "POWER");
  if (!waterItem || !powerItem) throw new HttpError(400, "账单缺少水电项目");
  if (currentWater < previousWater) throw new HttpError(400, "水表本期读数不能小于上期读数");
  if (currentPower < previousPower) throw new HttpError(400, "电表本期读数不能小于上期读数");

  const { waterAmount, powerAmount } = calculateUtilityLineAmounts({
    previousWater,
    currentWater,
    waterUnitPrice: waterItem.waterUnitPrice ?? 0,
    previousPower,
    currentPower,
    powerUnitPrice: powerItem.powerUnitPrice ?? 0
  });

  await prisma.$transaction([
    prisma.billItem.update({
      where: { id: waterItem.id },
      data: { previousWater, currentWater, amount: waterAmount, status: "UNPAID" }
    }),
    prisma.billItem.update({
      where: { id: powerItem.id },
      data: { previousPower, currentPower, amount: powerAmount, status: "UNPAID" }
    }),
    prisma.bill.update({ where: { id: bill.id }, data: { status: "UNPAID", failureReason: null } })
  ]);
  await refreshBillTotals(bill.id);
  return prisma.bill.findUnique({ where: { id: bill.id }, include: { items: true } });
};

billRouter.post(
  "/:id/utility-reading",
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
    ok(res, await applyUtilityReadingToBill({ billId: req.params.id, organizationId: req.organizationId!, ...input }));
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
      toCsv([
        ["billId", "房间号", "租客", "交租日", "水电周期开始", "水电周期结束", "上月水表", "本月水表", "上月电表", "本月电表", "失败原因"],
        ...bills.map((bill) => [
          bill.id,
          bill.lease.room.roomNo,
          bill.lease.tenantName,
          bill.billingDate.toISOString(),
          bill.periodStart.toISOString(),
          bill.periodEnd.toISOString(),
          "",
          "",
          "",
          "",
          bill.failureReason ?? ""
        ])
      ])
    );
  })
);

billRouter.post(
  "/utility/import",
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z.object({ csv: z.string().optional(), rows: z.array(z.object({
      billId: z.string(),
      previousWater: z.coerce.number(),
      currentWater: z.coerce.number(),
      previousPower: z.coerce.number(),
      currentPower: z.coerce.number()
    })).optional() }).parse(req.body);
    const rows = input.csv ? parseUtilityImportRows(input.csv) : input.rows ?? [];
    const results = [];
    for (const row of rows) {
      results.push(await applyUtilityReadingToBill({ ...row, organizationId: req.organizationId! }));
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
    const input = z.object({ amount: z.coerce.number().positive(), method: z.string().min(1), note: z.string().optional() }).parse(req.body);
    ok(res, await recordBillPayment({ billId: req.params.id, organizationId: req.organizationId!, userId: req.user!.id, ...input }));
  })
);
