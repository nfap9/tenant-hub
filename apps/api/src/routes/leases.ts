import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from '../middleware/auth.js';
import { generateLeaseBills } from '../services/billing.js';
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

const amountSchema = z.coerce.number().nonnegative();
const feeItemTypeSchema = z
  .enum([
    'MANAGEMENT',
    'SANITATION',
    'ELEVATOR',
    'PROPERTY',
    'NETWORK',
    'OTHER',
  ])
  .default('OTHER');

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
    const input = z
      .object({
        roomId: z.string(),
        tenantName: z.string().min(1),
        tenantPhone: z.string().min(6),
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        cycle: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']),
        rentAmount: amountSchema,
        depositAmount: amountSchema.default(0),
        waterUnitPrice: amountSchema,
        powerUnitPrice: amountSchema,
        autoRenew: z.boolean().default(false),
        status: z.enum(['DRAFT', 'ACTIVE']).default('ACTIVE'),
        fees: z
          .array(
            z.object({
              type: feeItemTypeSchema,
              name: z.string().min(1),
              amount: amountSchema,
            })
          )
          .default([]),
        generateHistoricalBills: z.boolean().default(false),
      })
      .refine((data) => data.endDate >= data.startDate, {
        path: ['endDate'],
        message: '租约结束日期不能早于开始日期',
      })
      .parse(req.body);

    const { fees, roomId, generateHistoricalBills, ...leaseData } = input;
    const room = await findRoomById(roomId, req.organizationId!);
    if (!room) throw new HttpError(404, '房间不存在');

    const isDraft = leaseData.status === 'DRAFT';

    if (!isDraft && room.status !== 'VACANT' && room.status !== 'RESERVED')
      throw new HttpError(400, '仅空闲或已预留房间可以签约');
    if (isDraft && room.status !== 'VACANT' && room.status !== 'RESERVED')
      throw new HttpError(400, '仅空闲或已预留房间可以保存草稿');

    let lease;
    if (leaseData.depositAmount > 0) {
      lease = await createLeaseWithDeposit({
        leaseData: {
          ...leaseData,
          rentAmount: new Prisma.Decimal(leaseData.rentAmount),
          depositAmount: new Prisma.Decimal(leaseData.depositAmount),
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
    } else {
      lease = await createLeaseWithoutDeposit({
        leaseData: {
          ...leaseData,
          rentAmount: new Prisma.Decimal(leaseData.rentAmount),
          depositAmount: new Prisma.Decimal(leaseData.depositAmount),
          waterUnitPrice: new Prisma.Decimal(leaseData.waterUnitPrice),
          powerUnitPrice: new Prisma.Decimal(leaseData.powerUnitPrice),
        },
        roomId,
        organizationId: req.organizationId!,
        fees: fees.map((fee) => ({
          ...fee,
          amount: new Prisma.Decimal(fee.amount),
        })),
      });
    }

    if (!isDraft) {
      await updateRoomStatus(roomId, 'OCCUPIED');

      const isHistorical = startOfLeaseDay(input.startDate).isBefore(
        startOfLeaseDay(new Date()),
        'day'
      );
      await generateLeaseBills(lease.id, new Date(), {
        onlyCurrentPeriod: isHistorical && !generateHistoricalBills,
      });
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
        depositAmount: amountSchema.optional(),
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
        ...(leaseData.depositAmount !== undefined && {
          depositAmount: new Prisma.Decimal(leaseData.depositAmount),
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
    const input = z
      .object({
        type: z.enum(['EXPIRED', 'NEGOTIATED', 'BREACH']),
        reason: z.string().optional(),
        terminatedAt: z.coerce.date().default(new Date()),
        rentAdjustmentAmount: z.coerce.number().default(0),
        currentWater: amountSchema,
        currentPower: amountSchema,
        otherFeeAmount: amountSchema.default(0),
        otherFeeReason: z.string().optional(),
        penaltyAmount: amountSchema.default(0),
        penaltyReason: z.string().optional(),
        compensationAmount: amountSchema.default(0),
        compensationReason: z.string().optional(),
      })
      .parse(req.body);
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
    const input = z
      .object({
        direction: z.enum(['RECEIVE', 'REFUND']),
        amount: z.coerce.number().positive(),
        method: z.string().min(1),
        note: z.string().optional(),
      })
      .parse(req.body);
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
