import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from '../middleware/auth.js';
import {
  generateLeaseBills,
  generateHistoricalLeaseBills,
  recordBillPayment,
} from '../services/billing.js';
import {
  assertExpiredTerminationAllowed,
  startOfLeaseDay,
  withLeaseLifecycle,
} from '../services/leaseLifecycle.js';
import {
  createLeaseSettlement,
  getLeaseSettlementPreview,
  recordSettlementPayment,
} from '../services/leaseSettlement.js';
import { PERMISSIONS } from '../services/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, ok } from '../utils/http.js';
import {
  listLeases,
  getLeaseById,
  findRoomById,
  createLeaseWithDeposit,
  createLeaseWithoutDeposit,
  updateRoomStatus,
  updateLease,
  getLeaseWithFees,
  activateLease,
  getLeaseEndDate,
  listLeaseSettlements,
} from '../services/lease.js';

export const leaseRouter = Router();
leaseRouter.use(requireAuth, requireOrg);

export const amountSchema = z.coerce.number().nonnegative();
export const feeItemTypeSchema = z
  .enum([
    'MANAGEMENT',
    'SANITATION',
    'ELEVATOR',
    'PROPERTY',
    'NETWORK',
    'OTHER',
  ])
  .default('OTHER');

export const createLeaseInput = z
  .object({
    roomId: z.string().describe('房间ID'),
    tenantName: z.string().optional().describe('租户姓名'),
    tenantPhone: z.string().optional().describe('租户手机号'),
    startDate: z.coerce.date().describe('租约开始日期'),
    endDate: z.coerce.date().describe('租约结束日期'),
    cycle: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).describe('付款周期'),
    rentAmount: amountSchema.describe('月租金'),
    roomDepositAmount: amountSchema.default(0).describe('房间押金'),
    keyQuantity: z.coerce.number().int().min(0).default(0).describe('钥匙数量'),
    keyUnitPrice: amountSchema.default(0).describe('钥匙单价'),
    waterUnitPrice: amountSchema.describe('水费单价'),
    powerUnitPrice: amountSchema.describe('电费单价'),
    autoRenew: z.boolean().default(false).describe('是否自动续约'),
    status: z.enum(['DRAFT', 'ACTIVE']).default('ACTIVE').describe('状态'),
    fees: z
      .array(
        z.object({
          type: feeItemTypeSchema.describe('费用类型'),
          name: z.string().min(1).describe('费用名称'),
          amount: amountSchema.describe('金额'),
        })
      )
      .default([])
      .describe('附加费用列表'),
    historicalBills: z
      .array(
        z.object({
          billingDate: z.coerce.date().describe('历史账单计费日'),
          currentWater: z.coerce
            .number()
            .min(0)
            .default(0)
            .describe('期末水表读数'),
          currentPower: z.coerce
            .number()
            .min(0)
            .default(0)
            .describe('期末电表读数'),
          settled: z.boolean().default(false).describe('该期是否已结清'),
        })
      )
      .default([])
      .describe('历史账单列表'),
    historicalBaseWater: z.coerce
      .number()
      .min(0)
      .default(0)
      .describe('历史水表底数'),
    historicalBasePower: z.coerce
      .number()
      .min(0)
      .default(0)
      .describe('历史电表底数'),
    depositSettled: z.boolean().default(false).describe('押金是否已结清'),
  })
  .refine((data) => data.endDate >= data.startDate, {
    path: ['endDate'],
    message: '租约结束日期不能早于开始日期',
  });

export const terminateLeaseInput = z.object({
  type: z.enum(['EXPIRED', 'NEGOTIATED', 'BREACH']).describe('退租类型'),
  reason: z.string().optional().describe('退租原因'),
  terminatedAt: z.coerce.date().default(new Date()).describe('退租日期'),
  rentAdjustmentAmount: z.coerce.number().default(0).describe('租金调整金额'),
  currentWater: amountSchema.describe('退租时水表读数'),
  currentPower: amountSchema.describe('退租时电表读数'),
  otherFeeAmount: amountSchema.default(0).describe('其他费用金额'),
  otherFeeReason: z.string().optional().describe('其他费用原因'),
  penaltyAmount: amountSchema.default(0).describe('违约金'),
  penaltyReason: z.string().optional().describe('违约金原因'),
  compensationAmount: amountSchema.default(0).describe('赔偿金'),
  compensationReason: z.string().optional().describe('赔偿金原因'),
  roomDepositRefundAmount: amountSchema.default(0).describe('房间押金退还金额'),
  keyDepositRefundAmount: amountSchema.default(0).describe('钥匙押金退还金额'),
  roomDepositDeductionAmount: amountSchema
    .default(0)
    .describe('房间押金扣款金额'),
  keyDepositDeductionAmount: amountSchema
    .default(0)
    .describe('钥匙押金扣款金额'),
  depositDeductionReason: z.string().optional().describe('押金扣款原因'),
});

export const settlementPaymentInput = z.object({
  direction: z.enum(['RECEIVE', 'REFUND']).describe('收退方向'),
  amount: z.coerce.number().positive().describe('金额'),
  method: z.string().min(1).describe('方式'),
  note: z.string().optional().describe('备注'),
});

leaseRouter.get(
  '/',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    ok(res, await listLeases(req.organizationId!));
  })
);

leaseRouter.post(
  '/',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = createLeaseInput.parse(req.body);

    const {
      fees,
      roomId,
      historicalBills,
      historicalBaseWater,
      historicalBasePower,
      depositSettled,
      ...leaseData
    } = input;
    const room = await findRoomById(roomId, req.organizationId!);
    if (!room) throw new HttpError(404, '房间不存在');

    const isDraft = leaseData.status === 'DRAFT';

    if (room.status === 'SELF_USE')
      throw new HttpError(400, '自用房间不可签约');
    if (!isDraft && room.status !== 'VACANT' && room.status !== 'RESERVED')
      throw new HttpError(400, '仅空闲或已预留房间可以签约');
    if (isDraft && room.status !== 'VACANT' && room.status !== 'RESERVED')
      throw new HttpError(400, '仅空闲或已预留房间可以保存草稿');

    const roomDepositAmount = new Prisma.Decimal(leaseData.roomDepositAmount);
    const keyDepositAmount = new Prisma.Decimal(leaseData.keyQuantity).mul(
      new Prisma.Decimal(leaseData.keyUnitPrice)
    );
    const depositAmount = roomDepositAmount.plus(keyDepositAmount);

    const createFn = depositAmount.greaterThan(0)
      ? createLeaseWithDeposit
      : createLeaseWithoutDeposit;

    const lease = await createFn({
      leaseData: {
        ...leaseData,
        rentAmount: new Prisma.Decimal(leaseData.rentAmount),
        depositAmount,
        roomDepositAmount,
        keyQuantity: leaseData.keyQuantity,
        keyUnitPrice: new Prisma.Decimal(leaseData.keyUnitPrice),
        waterUnitPrice: new Prisma.Decimal(leaseData.waterUnitPrice),
        powerUnitPrice: new Prisma.Decimal(leaseData.powerUnitPrice),
      },
      roomId,
      organizationId: req.organizationId!,
      userId: req.user!.id,
      fees: fees.map((fee) => ({
        ...fee,
        amount: new Prisma.Decimal(fee.amount),
      })),
    });

    if (!isDraft) {
      await updateRoomStatus(roomId, 'OCCUPIED');

      const isHistorical = startOfLeaseDay(input.startDate).isBefore(
        startOfLeaseDay(new Date()),
        'day'
      );

      await generateLeaseBills(lease.id, new Date(), {
        onlyCurrentPeriod: true,
      });

      if (isHistorical && historicalBills.length > 0) {
        await generateHistoricalLeaseBills(
          lease.id,
          historicalBills.map((row) => ({
            ...row,
            currentWater: Number(row.currentWater),
            currentPower: Number(row.currentPower),
          })),
          {
            baseWater: Number(historicalBaseWater),
            basePower: Number(historicalBasePower),
          },
          req.user!.id
        );
      }

      if (depositSettled && lease.deposits) {
        const method = '历史结清';
        const note = '签约时押金已结清';
        for (const deposit of lease.deposits) {
          if (!deposit.billId) continue;
          const bill = await prisma.bill.findUnique({
            where: { id: deposit.billId },
          });
          if (!bill || bill.status === 'PAID') continue;
          await recordBillPayment({
            billId: bill.id,
            organizationId: req.organizationId!,
            userId: req.user!.id,
            amount: bill.totalAmount,
            method,
            note,
          });
        }
      }
    }

    ok(res, withLeaseLifecycle(lease));
  })
);

leaseRouter.put(
  '/:id',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        rentAmount: amountSchema.optional(),
        roomDepositAmount: amountSchema.optional(),
        keyQuantity: z.coerce.number().int().min(0).optional(),
        keyUnitPrice: amountSchema.optional(),
        waterUnitPrice: amountSchema.optional(),
        powerUnitPrice: amountSchema.optional(),
        fees: z
          .array(
            z.object({
              type: feeItemTypeSchema,
              name: z.string().min(1),
              amount: amountSchema,
            })
          )
          .optional(),
      })
      .parse(req.body);

    const lease = await getLeaseById(req.params.id, req.organizationId!);
    if (!lease) throw new HttpError(404, '租约不存在');
    if (lease.status !== 'ACTIVE')
      throw new HttpError(400, '仅有效租约可以变更');

    const { fees, ...leaseData } = input;
    const updated = await updateLease(req.params.id, {
      leaseData: {
        ...(leaseData.rentAmount !== undefined && {
          rentAmount: new Prisma.Decimal(leaseData.rentAmount),
        }),
        ...(leaseData.roomDepositAmount !== undefined && {
          roomDepositAmount: new Prisma.Decimal(leaseData.roomDepositAmount),
        }),
        ...(leaseData.keyQuantity !== undefined && {
          keyQuantity: leaseData.keyQuantity,
        }),
        ...(leaseData.keyUnitPrice !== undefined && {
          keyUnitPrice: new Prisma.Decimal(leaseData.keyUnitPrice),
        }),
        ...(leaseData.waterUnitPrice !== undefined && {
          waterUnitPrice: new Prisma.Decimal(leaseData.waterUnitPrice),
        }),
        ...(leaseData.powerUnitPrice !== undefined && {
          powerUnitPrice: new Prisma.Decimal(leaseData.powerUnitPrice),
        }),
      },
      fees: fees?.map((fee) => ({
        ...fee,
        amount: new Prisma.Decimal(fee.amount),
      })),
    });

    ok(res, withLeaseLifecycle(updated));
  })
);

leaseRouter.post(
  '/:id/activate',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const lease = await getLeaseWithFees(req.params.id, req.organizationId!);
    if (!lease) throw new HttpError(404, '租约不存在');
    if (lease.status !== 'DRAFT')
      throw new HttpError(400, '仅草稿状态的租约可以激活');

    const room = await findRoomById(lease.roomId, req.organizationId!);
    if (!room) throw new HttpError(404, '房间不存在');
    if (room.status !== 'VACANT' && room.status !== 'RESERVED')
      throw new HttpError(400, '房间已被占用，无法激活租约');

    const activated = await activateLease({
      leaseId: lease.id,
      organizationId: req.organizationId!,
      userId: req.user!.id,
    });

    await updateRoomStatus(lease.roomId, 'OCCUPIED');

    const isHistorical = startOfLeaseDay(lease.startDate).isBefore(
      startOfLeaseDay(new Date()),
      'day'
    );
    await generateLeaseBills(lease.id, new Date(), {
      onlyCurrentPeriod: isHistorical,
    });

    ok(res, withLeaseLifecycle(activated));
  })
);

leaseRouter.post(
  '/:id/terminate',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = terminateLeaseInput.parse(req.body);
    const current = await getLeaseEndDate(req.params.id, req.organizationId!);
    if (!current) throw new HttpError(404, '租约不存在');
    if (input.type === 'EXPIRED') {
      try {
        assertExpiredTerminationAllowed(current.endDate, input.terminatedAt);
      } catch (error) {
        throw new HttpError(
          400,
          error instanceof Error
            ? error.message
            : '到期解约的退租日期不能早于原租约结束日期'
        );
      }
    }
    const result = await createLeaseSettlement({
      leaseId: req.params.id,
      organizationId: req.organizationId!,
      userId: req.user!.id,
      input,
    });
    ok(res, result);
  })
);

leaseRouter.get(
  '/:id/settlement-preview',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    const terminatedAt = z.coerce
      .date()
      .default(new Date())
      .parse(req.query.terminatedAt);
    ok(
      res,
      await getLeaseSettlementPreview({
        leaseId: req.params.id,
        organizationId: req.organizationId!,
        terminatedAt,
      })
    );
  })
);

leaseRouter.get(
  '/settlements',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    ok(res, await listLeaseSettlements(req.organizationId!));
  })
);

leaseRouter.post(
  '/settlements/:id/payments',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = settlementPaymentInput.parse(req.body);
    ok(
      res,
      await recordSettlementPayment({
        settlementId: req.params.id,
        organizationId: req.organizationId!,
        userId: req.user!.id,
        ...input,
      })
    );
  })
);
