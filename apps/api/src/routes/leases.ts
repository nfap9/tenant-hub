import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
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

export const leaseRouter = Router();
leaseRouter.use(requireAuth, requireOrg);

const leaseInclude = {
  room: { include: { apartment: true } },
  fees: true,
  deposit: true,
} as const;
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
    ok(
      res,
      (
        await prisma.lease.findMany({
          where: { organizationId: req.organizationId! },
          include: leaseInclude,
          orderBy: { createdAt: 'desc' },
        })
      ).map((lease) => withLeaseLifecycle(lease))
    );
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
    const room = await prisma.room.findFirst({
      where: { id: roomId, apartment: { organizationId: req.organizationId! } },
      select: { id: true, status: true },
    });
    if (!room) throw new HttpError(404, '房间不存在');

    const isDraft = leaseData.status === 'DRAFT';

    if (!isDraft && room.status !== 'VACANT' && room.status !== 'RESERVED')
      throw new HttpError(400, '仅空闲或已预留房间可以签约');
    if (isDraft && room.status !== 'VACANT' && room.status !== 'RESERVED')
      throw new HttpError(400, '仅空闲或已预留房间可以保存草稿');

    let lease;
    if (leaseData.depositAmount > 0) {
      lease = await prisma.$transaction(async (tx) => {
        const created = await tx.lease.create({
          data: {
            ...leaseData,
            organizationId: req.organizationId!,
            roomId,
            status: leaseData.status,
            fees: { create: fees },
          },
          include: { room: { include: { apartment: true } }, fees: true },
        });

        if (!isDraft) {
          const reservation = await tx.reservation.findUnique({
            where: { roomId },
          });
          const offset =
            reservation && reservation.deposit.greaterThan(0)
              ? reservation.deposit
              : new Prisma.Decimal(0);
          const netDeposit = new Prisma.Decimal(leaseData.depositAmount).minus(
            offset
          );

          const bill = await tx.bill.create({
            data: {
              organizationId: req.organizationId!,
              leaseId: created.id,
              mode: 'DEPOSIT',
              billingDate: startOfLeaseDay(leaseData.startDate).toDate(),
              periodStart: startOfLeaseDay(leaseData.startDate).toDate(),
              periodEnd: startOfLeaseDay(leaseData.endDate).toDate(),
              dueDate: startOfLeaseDay(leaseData.startDate).toDate(),
              status: netDeposit.lessThanOrEqualTo(0) ? 'PAID' : 'UNPAID',
              totalAmount: netDeposit,
              paidAmount: offset,
              note: offset.greaterThan(0) ? '预留定金已抵扣' : undefined,
              items: {
                create: [
                  {
                    type: 'DEPOSIT',
                    name: offset.greaterThan(0)
                      ? '押金（预留定金已抵扣）'
                      : '押金',
                    amount: netDeposit,
                    status: netDeposit.lessThanOrEqualTo(0) ? 'PAID' : 'UNPAID',
                  },
                ],
              },
            },
          });

          if (offset.greaterThan(0)) {
            await tx.payment.create({
              data: {
                billId: bill.id,
                userId: req.user!.id,
                type: 'DEDUCT',
                amount: offset,
                method: reservation?.paymentMethod || '预留定金抵扣',
                note: '预留定金转押金',
                status: 'COMPLETED',
              },
            });
          }

          await tx.deposit.create({
            data: {
              organizationId: req.organizationId!,
              leaseId: created.id,
              billId: bill.id,
              amount: leaseData.depositAmount,
              paidAmount: offset,
              status: offset.greaterThan(0) ? 'PAID' : 'UNPAID',
            },
          });

          if (reservation) {
            await tx.reservation.delete({ where: { roomId } });
          }
        }

        return tx.lease.findUniqueOrThrow({
          where: { id: created.id },
          include: leaseInclude,
        });
      });
    } else {
      lease = await prisma.lease.create({
        data: {
          ...leaseData,
          organizationId: req.organizationId!,
          roomId,
          status: leaseData.status,
          fees: { create: fees },
        },
        include: leaseInclude,
      });
    }

    if (!isDraft) {
      await prisma.room.update({
        where: { id: roomId },
        data: { status: 'OCCUPIED' },
      });

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

    const lease = await prisma.lease.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      include: { fees: true },
    });
    if (!lease) throw new HttpError(404, '租约不存在');
    if (lease.status !== 'ACTIVE')
      throw new HttpError(400, '仅有效租约可以变更');

    const { fees, ...leaseData } = input;
    const updated = await prisma.$transaction(async (tx) => {
      if (fees) {
        await tx.leaseFee.deleteMany({ where: { leaseId: lease.id } });
        await tx.leaseFee.createMany({
          data: fees.map((fee) => ({ ...fee, leaseId: lease.id })),
        });
      }
      if (leaseData.depositAmount !== undefined) {
        const deposit = await tx.deposit.findUnique({
          where: { leaseId: lease.id },
        });
        if (deposit && deposit.status === 'UNPAID') {
          await tx.deposit.update({
            where: { leaseId: lease.id },
            data: { amount: leaseData.depositAmount },
          });
        }
      }
      return tx.lease.update({
        where: { id: lease.id },
        data: leaseData,
        include: leaseInclude,
      });
    });

    ok(res, withLeaseLifecycle(updated));
  })
);

leaseRouter.post(
  '/:id/activate',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const lease = await prisma.lease.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      include: { fees: true },
    });
    if (!lease) throw new HttpError(404, '租约不存在');
    if (lease.status !== 'DRAFT')
      throw new HttpError(400, '仅草稿状态的租约可以激活');

    const room = await prisma.room.findFirst({
      where: { id: lease.roomId },
      select: { id: true, status: true },
    });
    if (!room) throw new HttpError(404, '房间不存在');
    if (room.status !== 'VACANT' && room.status !== 'RESERVED')
      throw new HttpError(400, '房间已被占用，无法激活租约');

    const activated = await prisma.$transaction(async (tx) => {
      if (lease.depositAmount.greaterThan(0)) {
        const reservation = await tx.reservation.findUnique({
          where: { roomId: lease.roomId },
        });
        const offset =
          reservation && reservation.deposit.greaterThan(0)
            ? reservation.deposit
            : new Prisma.Decimal(0);
        const netDeposit = new Prisma.Decimal(lease.depositAmount).minus(
          offset
        );
        const bill = await tx.bill.create({
          data: {
            organizationId: req.organizationId!,
            leaseId: lease.id,
            mode: 'DEPOSIT',
            billingDate: startOfLeaseDay(lease.startDate).toDate(),
            periodStart: startOfLeaseDay(lease.startDate).toDate(),
            periodEnd: startOfLeaseDay(lease.endDate).toDate(),
            dueDate: startOfLeaseDay(lease.startDate).toDate(),
            status: netDeposit.lessThanOrEqualTo(0) ? 'PAID' : 'UNPAID',
            totalAmount: netDeposit,
            paidAmount: offset,
            note: offset.greaterThan(0) ? '预留定金已抵扣' : undefined,
            items: {
              create: [
                {
                  type: 'DEPOSIT',
                  name: offset.greaterThan(0)
                    ? '押金（预留定金已抵扣）'
                    : '押金',
                  amount: netDeposit,
                  status: netDeposit.lessThanOrEqualTo(0) ? 'PAID' : 'UNPAID',
                },
              ],
            },
          },
        });

        if (offset.greaterThan(0)) {
          await tx.payment.create({
            data: {
              billId: bill.id,
              userId: req.user!.id,
              type: 'DEDUCT',
              amount: offset,
              method: reservation?.paymentMethod || '预留定金抵扣',
              note: '预留定金转押金',
              status: 'COMPLETED',
            },
          });
        }

        await tx.deposit.create({
          data: {
            organizationId: req.organizationId!,
            leaseId: lease.id,
            billId: bill.id,
            amount: lease.depositAmount,
            paidAmount: offset,
            status: offset.greaterThan(0) ? 'PAID' : 'UNPAID',
          },
        });

        if (reservation) {
          await tx.reservation.delete({ where: { roomId: lease.roomId } });
        }
      }

      const updated = await tx.lease.update({
        where: { id: lease.id },
        data: { status: 'ACTIVE' },
        include: leaseInclude,
      });

      return updated;
    });

    await prisma.room.update({
      where: { id: lease.roomId },
      data: { status: 'OCCUPIED' },
    });

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
    const current = await prisma.lease.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      select: { id: true, endDate: true },
    });
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
    ok(
      res,
      await prisma.leaseSettlement.findMany({
        where: { organizationId: req.organizationId! },
        include: {
          lease: { include: leaseInclude },
          room: true,
          payments: {
            include: {
              user: { select: { id: true, username: true, phone: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    );
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
