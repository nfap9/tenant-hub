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
  startOfLeaseDay,
  withLeaseLifecycle,
} from '../services/leaseLifecycle.js';
import { PERMISSIONS } from '../services/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError, ok } from '../utils/http.js';
import {
  listLeases,
  getLeaseById,
  getLeaseDetail,
  findRoomById,
  createLeaseWithDeposit,
  createLeaseWithoutDeposit,
  updateRoomStatus,
  updateLease,
  getLeaseWithFees,
  activateLease,
  calculateKeyDepositAmount,
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
    rentCycle: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).describe('付款周期'),
    rentAmount: amountSchema.describe('月租金'),
    roomDepositAmount: amountSchema.default(0).describe('房间押金'),
    keyDepositAmount: amountSchema.optional().describe('钥匙押金'),
    keyQuantity: z.coerce.number().int().min(0).default(0).describe('钥匙数量'),
    keyUnitPrice: amountSchema.default(0).describe('钥匙单价'),
    waterUnitPrice: amountSchema.default(0).describe('水费单价'),
    powerUnitPrice: amountSchema.default(0).describe('电费单价'),
    initialWaterReading: z.coerce
      .number()
      .min(0)
      .default(0)
      .describe('初始水表读数'),
    initialPowerReading: z.coerce
      .number()
      .min(0)
      .default(0)
      .describe('初始电表读数'),
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

/**
 * GET /api/leases
 * 获取当前组织下的租约列表
 */
leaseRouter.get(
  '/',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    ok(res, await listLeases(req.organizationId!));
  })
);

/**
 * GET /api/leases/:id
 * 获取指定租约的详细信息
 */
leaseRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    const lease = await getLeaseDetail(req.params.id, req.organizationId!);
    if (!lease) throw new HttpError(404, '租约不存在');
    ok(res, lease);
  })
);

/**
 * POST /api/leases
 * 创建新租约，支持草稿和直接激活，可一并处理历史账单和押金结清
 */
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
      roomDepositAmount,
      keyDepositAmount,
      keyQuantity,
      keyUnitPrice,
      initialWaterReading,
      initialPowerReading,
      ...leaseData
    } = input;
    const room = await findRoomById(roomId, req.organizationId!);
    if (!room) throw new HttpError(404, '房间不存在');

    const isDraft = leaseData.status === 'DRAFT';

    if (room.status === 'SELF_USE')
      throw new HttpError(400, '自用房间不可签约');
    if (!isDraft && room.status !== 'VACANT')
      throw new HttpError(400, '仅空闲房间可以签约');
    if (isDraft && room.status !== 'VACANT')
      throw new HttpError(400, '仅空闲房间可以保存草稿');

    const roomDeposit = new Prisma.Decimal(roomDepositAmount);
    const keyDeposit =
      keyDepositAmount !== undefined
        ? new Prisma.Decimal(keyDepositAmount)
        : calculateKeyDepositAmount(keyQuantity, keyUnitPrice);
    const depositAmount = roomDeposit.plus(keyDeposit);

    const createFn = depositAmount.greaterThan(0)
      ? createLeaseWithDeposit
      : createLeaseWithoutDeposit;

    const lease = (await createFn({
      leaseData: {
        ...leaseData,
        rentAmount: new Prisma.Decimal(leaseData.rentAmount),
        depositAmount,
        keyDepositAmount: keyDeposit,
        waterUnitPrice: new Prisma.Decimal(leaseData.waterUnitPrice),
        powerUnitPrice: new Prisma.Decimal(leaseData.powerUnitPrice),
      },
      roomId,
      organizationId: req.organizationId!,
      fees: fees.map((fee) => ({
        ...fee,
        amount: new Prisma.Decimal(fee.amount),
      })),
    })) as Awaited<ReturnType<typeof createLeaseWithDeposit>>;

    await prisma.meterReading.createMany({
      data: [
        {
          organizationId: req.organizationId!,
          apartmentId: lease.room.apartmentId,
          roomId: lease.roomId,
          leaseId: lease.id,
          meterType: 'WATER',
          readingDate: startOfLeaseDay(lease.startDate).toDate(),
          value: initialWaterReading,
        },
        {
          organizationId: req.organizationId!,
          apartmentId: lease.room.apartmentId,
          roomId: lease.roomId,
          leaseId: lease.id,
          meterType: 'POWER',
          readingDate: startOfLeaseDay(lease.startDate).toDate(),
          value: initialPowerReading,
        },
      ],
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

export const updateLeaseInput = z.object({
  rentAmount: amountSchema.optional().describe('月租金'),
  waterUnitPrice: amountSchema.optional().describe('水费单价'),
  powerUnitPrice: amountSchema.optional().describe('电费单价'),
  fees: z
    .array(
      z.object({
        type: feeItemTypeSchema.describe('费用类型'),
        name: z.string().min(1).describe('费用名称'),
        amount: amountSchema.describe('金额'),
      })
    )
    .optional()
    .describe('附加费用列表'),
});

/**
 * POST /api/leases/:id/update
 * 更新有效租约的租金、水电单价和附加费用
 */
leaseRouter.post(
  '/:id/update',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = updateLeaseInput.parse(req.body);

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

/**
 * POST /api/leases/:id/activate
 * 激活草稿状态的租约并生成账单
 */
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
    if (room.status !== 'VACANT')
      throw new HttpError(400, '房间已被占用，无法激活租约');

    const activated = await activateLease({
      leaseId: lease.id,
      organizationId: req.organizationId!,
      userId: req.user!.id,
    });

    await updateRoomStatus(lease.roomId, 'OCCUPIED');

    const existingReadingCount = await prisma.meterReading.count({
      where: { leaseId: lease.id },
    });
    if (existingReadingCount === 0) {
      await prisma.meterReading.createMany({
        data: [
          {
            organizationId: req.organizationId!,
            apartmentId: lease.room.apartmentId,
            roomId: lease.roomId,
            leaseId: lease.id,
            meterType: 'WATER',
            readingDate: startOfLeaseDay(lease.startDate).toDate(),
            value: 0,
          },
          {
            organizationId: req.organizationId!,
            apartmentId: lease.room.apartmentId,
            roomId: lease.roomId,
            leaseId: lease.id,
            meterType: 'POWER',
            readingDate: startOfLeaseDay(lease.startDate).toDate(),
            value: 0,
          },
        ],
      });
    }

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
