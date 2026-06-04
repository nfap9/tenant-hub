import { Router } from 'express';
import { z } from 'zod';
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from '../middleware/auth.js';
import {
  assertBillOperation,
  generateCurrentLeaseBills,
  generateLeaseBills,
  recordBillPayment,
  refundBill,
  retryPostpaidBillAndMonthlyBill,
  voidBill,
} from '../services/billing.js';
import { toCsv } from '../services/csv.js';
import { PERMISSIONS } from '../services/roles.js';
import { parseUtilityImportRows } from '../services/utilityImport.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, ok } from '../utils/http.js';
import {
  listBills,
  findLeaseById,
  listMeterReadings,
  findRoomForMeterReading,
  findLeaseForMeterReading,
  createMeterReading,
  findPendingPostpaidBillsByRoom,
  applyUtilityReadingToBill,
  findPendingPostpaidBillsForExport,
  getBillForRetry,
  getBillById,
  deleteBillWithPayments,
} from '../services/bill.js';

export const billRouter = Router();
billRouter.use(requireAuth, requireOrg);

billRouter.get(
  '/',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const status = z
      .enum([
        'DRAFT',
        'BILLING',
        'UNPAID',
        'PARTIAL_PAID',
        'PAID',
        'FAILED',
        'VOID',
      ])
      .optional()
      .parse(req.query.status);
    ok(res, await listBills(req.organizationId!, status));
  })
);

billRouter.post(
  '/generate',
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
    const lease = await findLeaseById(input.leaseId, req.organizationId!);
    if (!lease) throw new HttpError(404, '租约不存在');
    ok(res, {
      billIds: await generateLeaseBills(
        input.leaseId,
        input.today ?? new Date()
      ),
    });
  })
);

billRouter.get(
  '/meter-readings',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const roomId = z.string().optional().parse(req.query.roomId);
    ok(res, await listMeterReadings(req.organizationId!, roomId));
  })
);

billRouter.post(
  '/meter-readings',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        roomId: z.string(),
        meterType: z.enum(['WATER', 'POWER']),
        readingDate: z.coerce.date(),
        value: z.coerce.number().nonnegative(),
        source: z.enum(['MANUAL', 'IMPORT']).default('MANUAL'),
        status: z
          .enum(['NORMAL', 'SUSPECTED', 'CONFIRMED', 'VOID'])
          .default('NORMAL'),
        note: z.string().optional(),
      })
      .parse(req.body);
    const room = await findRoomForMeterReading(
      input.roomId,
      req.organizationId!
    );
    if (!room) throw new HttpError(404, '房间不存在');
    const lease = await findLeaseForMeterReading(
      room.id,
      req.organizationId!,
      input.readingDate
    );

    const reading = await createMeterReading({
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
      createdById: req.user!.id,
    });

    // 尝试自动完成该房间所有待出账的后付费账单
    const pendingBills = await findPendingPostpaidBillsByRoom(room.id);
    await Promise.all(
      pendingBills.map((b) =>
        retryPostpaidBillAndMonthlyBill(b.id).catch(() => null)
      )
    );

    ok(res, reading);
  })
);

billRouter.post(
  '/:id/utility-reading',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        previousWater: z.coerce.number(),
        currentWater: z.coerce.number(),
        previousPower: z.coerce.number(),
        currentPower: z.coerce.number(),
      })
      .parse(req.body);
    ok(
      res,
      await applyUtilityReadingToBill({
        billId: req.params.id,
        organizationId: req.organizationId!,
        userId: req.user!.id,
        ...input,
      })
    );
  })
);

billRouter.get(
  '/utility/pending-export',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const bills = await findPendingPostpaidBillsForExport(req.organizationId!);
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.send(
      toCsv([
        [
          'billId',
          '房间号',
          '租客',
          '交租日',
          '水电周期开始',
          '水电周期结束',
          '上月水表',
          '本月水表',
          '上月电表',
          '本月电表',
          '失败原因',
        ],
        ...bills.map((bill) => [
          bill.id,
          bill.lease.room.roomNo,
          bill.lease.tenantName,
          bill.billingDate.toISOString(),
          bill.periodStart.toISOString(),
          bill.periodEnd.toISOString(),
          '',
          '',
          '',
          '',
          bill.failureReason ?? '',
        ]),
      ])
    );
  })
);

billRouter.post(
  '/utility/import',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        csv: z.string().optional(),
        rows: z
          .array(
            z.object({
              billId: z.string(),
              previousWater: z.coerce.number(),
              currentWater: z.coerce.number(),
              previousPower: z.coerce.number(),
              currentPower: z.coerce.number(),
            })
          )
          .optional(),
      })
      .parse(req.body);
    const rows = input.csv
      ? parseUtilityImportRows(input.csv)
      : (input.rows ?? []);
    const results = [];
    for (const row of rows) {
      results.push(
        await applyUtilityReadingToBill({
          ...row,
          organizationId: req.organizationId!,
          userId: req.user!.id,
        })
      );
    }
    ok(res, results);
  })
);

billRouter.post(
  '/:id/retry-billing',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const bill = await getBillForRetry(req.params.id, req.organizationId!);
    if (!bill) throw new HttpError(404, '账单不存在');
    if (bill.mode !== 'POSTPAID')
      throw new HttpError(400, '仅后付费账单需要重新出账');
    ok(res, await retryPostpaidBillAndMonthlyBill(bill.id));
  })
);

billRouter.post(
  '/:id/payments',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        amount: z.coerce.number().positive(),
        method: z.string().min(1),
        note: z.string().optional(),
      })
      .parse(req.body);
    ok(
      res,
      await recordBillPayment({
        billId: req.params.id,
        organizationId: req.organizationId!,
        userId: req.user!.id,
        ...input,
      })
    );
  })
);

billRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const bill = await getBillById(req.params.id, req.organizationId!);
    if (!bill) throw new HttpError(404, '账单不存在');
    assertBillOperation(bill.status, 'delete');

    await deleteBillWithPayments(req.params.id);

    ok(res, { deleted: true });
  })
);

billRouter.post(
  '/:id/void',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    ok(res, await voidBill(req.params.id, req.organizationId!));
  })
);

billRouter.post(
  '/:id/refund',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        amount: z.coerce.number().positive(),
        method: z.string().min(1),
        note: z.string().optional(),
      })
      .parse(req.body);
    ok(
      res,
      await refundBill({
        billId: req.params.id,
        organizationId: req.organizationId!,
        userId: req.user!.id,
        ...input,
      })
    );
  })
);
