import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from '../middleware/auth.js';
import {
  generateCurrentLeaseBills,
  generateLeaseBills,
  recordBillPayment,
  recordLeasePayment,
  retryPostpaidBillAndMonthlyBill,
  voidBill,
} from '../services/billing.js';
import { PERMISSIONS } from '../services/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, ok } from '../utils/http.js';
import {
  listBills,
  findLeaseById,
  listMeterReadings,
  listMeterReadingRooms,
  applyUtilityReadingToBill,
  getBillForRetry,
  getBillById,
  deleteBillWithPayments,
  recordRoomMeterReading,
} from '../services/bill.js';

export const billRouter = Router();
billRouter.use(requireAuth, requireOrg);

export const generateBillsInput = z.object({
  leaseId: z.string().optional().describe('租约ID（不填则为所有到期租约生成）'),
  today: z.coerce.date().optional().describe('账单生成基准日期'),
});

export const meterReadingInput = z.object({
  roomId: z.string().describe('房间ID'),
  readingDate: z.coerce.date().describe('抄表日期'),
  waterValue: z.coerce.number().nonnegative().describe('水表读数'),
  powerValue: z.coerce.number().nonnegative().describe('电表读数'),
  note: z.string().optional().describe('备注'),
});

export const utilityReadingInput = z.object({
  previousWater: z.coerce.number().describe('上期水表读数'),
  currentWater: z.coerce.number().describe('本期水表读数'),
  previousPower: z.coerce.number().describe('上期电表读数'),
  currentPower: z.coerce.number().describe('本期电表读数'),
});

export const billPaymentInput = z.object({
  amount: z.coerce.number().positive().describe('收款金额'),
  waiverAmount: z.coerce.number().min(0).max(1).default(0).describe('抹零金额'),
  method: z.string().min(1).describe('收款方式'),
  note: z.string().optional().describe('备注'),
  paidAt: z.coerce.date().optional().describe('收款时间'),
});

export const leasePaymentInput = z.object({
  leaseId: z.string().min(1).describe('租约ID'),
  amount: z.coerce.number().positive().describe('收款金额'),
  waiverAmount: z.coerce.number().min(0).max(1).default(0).describe('抹零金额'),
  method: z.string().min(1).describe('收款方式'),
  note: z.string().optional().describe('备注'),
  paidAt: z.coerce.date().optional().describe('收款时间'),
});

/**
 * GET /api/bills
 * 获取当前组织下的账单列表（可按状态筛选）
 */
billRouter.get(
  '/',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const status = z
      .enum(['UNPAID', 'PAID', 'VOID', 'PENDING'])
      .optional()
      .parse(req.query.status);
    ok(res, await listBills(req.organizationId!, status));
  })
);

/**
 * POST /api/bills/generate
 * 为指定租约或当前组织所有活跃租约生成账单
 */
billRouter.post(
  '/generate',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = generateBillsInput.parse(req.body);
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
      leaseCount: 1,
      billIds: await generateLeaseBills(
        input.leaseId,
        input.today ?? new Date()
      ),
    });
  })
);

/**
 * GET /api/bills/meter-readings
 * 获取当前组织下的抄表记录列表（可按房间筛选）
 */
billRouter.get(
  '/meter-readings',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const roomId = z.string().optional().parse(req.query.roomId);
    const apartmentId = z.string().optional().parse(req.query.apartmentId);
    const meterType = z
      .enum(['WATER', 'POWER'])
      .optional()
      .parse(req.query.meterType);
    const startDate = z.coerce.date().optional().parse(req.query.startDate);
    const endDate = z.coerce.date().optional().parse(req.query.endDate);
    ok(
      res,
      await listMeterReadings(req.organizationId!, {
        roomId,
        apartmentId,
        meterType,
        startDate,
        endDate,
      })
    );
  })
);

/**
 * GET /api/bills/meter-reading-rooms
 * 获取当前组织下有待抄表的房间列表（含最近一次水电读数）
 */
billRouter.get(
  '/meter-reading-rooms',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    ok(res, await listMeterReadingRooms(req.organizationId!));
  })
);

/**
 * POST /api/bills/meter-readings
 * 创建抄表记录，并自动尝试完成该房间待出账的后付费账单
 */
billRouter.post(
  '/meter-readings',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = meterReadingInput.parse(req.body);
    ok(
      res,
      await recordRoomMeterReading({
        organizationId: req.organizationId!,
        roomId: input.roomId,
        readingDate: input.readingDate,
        waterValue: input.waterValue,
        powerValue: input.powerValue,
        note: input.note,
      })
    );
  })
);

/**
 * POST /api/bills/:id/utility-reading
 * 为指定账单录入水电读数并计算水电费用
 */
billRouter.post(
  '/:id/utility-reading',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = utilityReadingInput.parse(req.body);
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

/**
 * GET /api/bills/:id
 * 获取指定账单的详细信息
 */
billRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const bill = await getBillById(req.params.id, req.organizationId!);
    if (!bill) throw new HttpError(404, '账单不存在');
    ok(res, bill);
  })
);

/**
 * POST /api/bills/:id/retry-billing
 * 重新根据抄表记录计算账单水电费用
 */
billRouter.post(
  '/:id/retry-billing',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const bill = await getBillForRetry(req.params.id, req.organizationId!);
    if (!bill) throw new HttpError(404, '账单不存在');
    const hasUtilityItems =
      bill.items.some(
        (item) => item.category === 'UTILITY' && item.name === '水费'
      ) &&
      bill.items.some(
        (item) => item.category === 'UTILITY' && item.name === '电费'
      );
    if (!hasUtilityItems)
      throw new HttpError(400, '仅包含水电项目的账单需要重新出账');
    ok(res, await retryPostpaidBillAndMonthlyBill(bill.id));
  })
);

/**
 * POST /api/bills/payments
 * 为指定租约记录收款，系统自动按账期顺序销账
 */
billRouter.post(
  '/payments',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = leasePaymentInput.parse(req.body);
    ok(
      res,
      await recordLeasePayment({
        leaseId: input.leaseId,
        organizationId: req.organizationId!,
        userId: req.user!.id,
        amount: input.amount,
        waiverAmount: input.waiverAmount,
        method: input.method,
        note: input.note,
        paidAt: input.paidAt,
      })
    );
  })
);

/**
 * POST /api/bills/:id/payments
 * 为指定账单记录收款
 */
billRouter.post(
  '/:id/payments',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const input = billPaymentInput.parse(req.body);
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

/**
 * DELETE /api/bills/:id
 * 删除指定账单及其付款记录
 * 未付款账单可直接删除；金额为 0 且没有实际收款的已结清账单也允许删除
 */
billRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    const bill = await getBillById(req.params.id, req.organizationId!);
    if (!bill) throw new HttpError(404, '账单不存在');

    const isZeroAmountDeletable =
      (bill.status === 'PAID' || bill.status === 'VOID') &&
      new Prisma.Decimal(bill.totalAmount).equals(0);

    if (!isZeroAmountDeletable) {
      throw new HttpError(
        400,
        `当前账单状态不允许删除（状态：${bill.status}，金额：${bill.totalAmount}，已付：${bill.paidAmount}）`
      );
    }

    await deleteBillWithPayments(req.params.id);

    ok(res, { deleted: true });
  })
);

/**
 * POST /api/bills/:id/void
 * 作废指定账单
 */
billRouter.post(
  '/:id/void',
  requirePermission(PERMISSIONS.BILL_MANAGE),
  asyncHandler(async (req, res) => {
    ok(res, await voidBill(req.params.id, req.organizationId!));
  })
);
