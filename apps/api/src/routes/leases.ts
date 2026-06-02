import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma/client.js';
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from '../middleware/auth.js';
import { generateLeaseBills } from '../services/billing.js';
import { populateBillQueue } from '../services/billQueue.js';
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
import { findOrCreateTenant } from '../services/tenant.js';
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
        tenantId: z.string().optional(),
        tenantName: z.string().min(1),
        tenantPhone: z.string().min(6),
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        billDay: z.number().int().min(1).max(28).optional(),
        utilityBillDay: z.number().int().min(1).max(28).optional(),
        paymentDueDays: z.coerce.number().int().min(0).default(7),
        graceDays: z.coerce.number().int().min(0).default(0),
        cycle: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']),
        rentAmount: amountSchema,
        depositMonths: z.coerce.number().int().min(0).default(1),
        depositAmount: amountSchema.default(0),
        waterUnitPrice: amountSchema,
        powerUnitPrice: amountSchema,
        gasUnitPrice: amountSchema.optional(),
        waterPricingTiers: z
          .array(z.object({ limit: z.number(), price: z.number() }))
          .optional(),
        powerPricingTiers: z
          .array(z.object({ limit: z.number(), price: z.number() }))
          .optional(),
        lateFeeRate: z.coerce.number().min(0).default(0.0005),
        freeRentDays: z.coerce.number().int().min(0).default(0),
        freeRentStart: z.coerce.date().optional(),
        freeRentEnd: z.coerce.date().optional(),
        autoRenew: z.boolean().default(false),
        signedBy: z.string().optional(),
        remark: z.string().optional(),
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

    const {
      fees,
      roomId,
      generateHistoricalBills,
      tenantId: inputTenantId,
      ...leaseData
    } = input;

    let resolvedTenantId = inputTenantId;
    if (!resolvedTenantId && leaseData.tenantPhone) {
      const tenant = await findOrCreateTenant(
        req.organizationId!,
        leaseData.tenantName,
        leaseData.tenantPhone
      );
      resolvedTenantId = tenant.id;
    }
    const room = await prisma.room.findFirst({
      where: { id: roomId, apartment: { organizationId: req.organizationId! } },
      select: { id: true, status: true },
    });
    if (!room) throw new HttpError(404, '房间不存在');
    if (room.status !== 'VACANT')
      throw new HttpError(400, '仅空闲房间可以签约');

    let lease;
    if (leaseData.depositAmount > 0) {
      lease = await prisma.$transaction(async (tx) => {
        const created = await tx.lease.create({
          data: {
            ...leaseData,
            tenantId: resolvedTenantId,
            organizationId: req.organizationId!,
            roomId,
            fees: { create: fees },
          },
          include: { room: { include: { apartment: true } }, fees: true },
        });

        const bill = await tx.bill.create({
          data: {
            organizationId: req.organizationId!,
            leaseId: created.id,
            mode: 'DEPOSIT',
            type: 'DEPOSIT',
            billingDate: startOfLeaseDay(leaseData.startDate).toDate(),
            periodStart: startOfLeaseDay(leaseData.startDate).toDate(),
            periodEnd: startOfLeaseDay(leaseData.endDate).toDate(),
            dueDate: startOfLeaseDay(leaseData.startDate).toDate(),
            status: 'UNPAID',
            totalAmount: leaseData.depositAmount,
            paidAmount: 0,
            items: {
              create: [
                {
                  type: 'DEPOSIT',
                  name: '押金',
                  amount: leaseData.depositAmount,
                  status: 'UNPAID',
                },
              ],
            },
          },
        });

        await tx.deposit.create({
          data: {
            organizationId: req.organizationId!,
            leaseId: created.id,
            billId: bill.id,
            amount: leaseData.depositAmount,
            status: 'UNPAID',
          },
        });

        return tx.lease.findUniqueOrThrow({
          where: { id: created.id },
          include: leaseInclude,
        });
      });
    } else {
      lease = await prisma.lease.create({
        data: {
          ...leaseData,
          tenantId: resolvedTenantId,
          organizationId: req.organizationId!,
          roomId,
          fees: { create: fees },
        },
        include: leaseInclude,
      });
    }
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
    await populateBillQueue(lease.id).catch(() => {});
    ok(res, withLeaseLifecycle(lease));
  })
);

leaseRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    const lease = await prisma.lease.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      include: {
        ...leaseInclude,
        coResidents: true,
        changeLogs: { orderBy: { changedAt: 'desc' } },
      },
    });
    if (!lease) throw new HttpError(404, '租约不存在');
    ok(res, withLeaseLifecycle(lease));
  })
);

leaseRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const lease = await prisma.lease.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      include: { room: { select: { status: true } } },
    });
    if (!lease) throw new HttpError(404, '租约不存在');
    if (lease.status !== 'DRAFT')
      throw new HttpError(400, '仅草稿租约可以删除');
    if (lease.room.status !== 'VACANT')
      throw new HttpError(400, '房间已被占用，无法删除');
    const bills = await prisma.bill.count({
      where: { leaseId: lease.id, status: { not: 'VOID' } },
    });
    if (bills > 0) throw new HttpError(400, '租约存在关联账单，无法删除');
    await prisma.lease.softDelete({ where: { id: lease.id } });
    ok(res, { deleted: true });
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
        gasUnitPrice: amountSchema.optional(),
        billDay: z.number().int().min(1).max(28).optional(),
        utilityBillDay: z.number().int().min(1).max(28).optional(),
        paymentDueDays: z.coerce.number().int().min(0).optional(),
        graceDays: z.coerce.number().int().min(0).optional(),
        lateFeeRate: z.coerce.number().min(0).optional(),
        freeRentDays: z.coerce.number().int().min(0).optional(),
        freeRentStart: z.coerce.date().optional(),
        freeRentEnd: z.coerce.date().optional(),
        autoRenew: z.boolean().optional(),
        signedBy: z.string().optional(),
        remark: z.string().optional(),
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

      const changeFields = Object.keys(leaseData) as Array<
        keyof typeof leaseData
      >;
      for (const field of changeFields) {
        const oldValue = String(lease[field as keyof typeof lease] ?? '');
        const newValue = String(leaseData[field] ?? '');
        if (oldValue !== newValue) {
          await tx.leaseChangeLog.create({
            data: {
              leaseId: lease.id,
              fieldName: field,
              oldValue,
              newValue,
              changedById: req.user!.id,
            },
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

// Get lease bills
leaseRouter.get(
  '/:id/bills',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    const bills = await prisma.bill.findMany({
      where: { leaseId: req.params.id, organizationId: req.organizationId! },
      include: { items: true, payments: true },
      orderBy: { billingDate: 'desc' },
    });
    ok(res, bills);
  })
);

// Get lease change logs
leaseRouter.get(
  '/:id/changes',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    const logs = await prisma.leaseChangeLog.findMany({
      where: { leaseId: req.params.id },
      orderBy: { changedAt: 'desc' },
    });
    ok(res, logs);
  })
);

// Cohabitants sub-resource
leaseRouter.get(
  '/:id/cohabitants',
  requirePermission(PERMISSIONS.LEASE_VIEW),
  asyncHandler(async (req, res) => {
    const residents = await prisma.coResident.findMany({
      where: {
        leaseId: req.params.id,
        tenant: { organizationId: req.organizationId! },
      },
      include: { tenant: true },
      orderBy: { createdAt: 'desc' },
    });
    ok(res, residents);
  })
);

leaseRouter.post(
  '/:id/cohabitants',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        tenantId: z.string(),
        name: z.string().min(1),
        idCard: z.string().optional(),
        phone: z.string().optional(),
        relation: z.string(),
      })
      .parse(req.body);

    const lease = await prisma.lease.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
    });
    if (!lease) throw new HttpError(404, '租约不存在');

    const tenant = await prisma.tenant.findFirst({
      where: { id: input.tenantId, organizationId: req.organizationId! },
    });
    if (!tenant) throw new HttpError(404, '租客不存在');

    ok(
      res,
      await prisma.coResident.create({
        data: { ...input, leaseId: req.params.id },
        include: { tenant: true },
      })
    );
  })
);

leaseRouter.put(
  '/:id/cohabitants/:cid',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        name: z.string().min(1).optional(),
        idCard: z.string().optional(),
        phone: z.string().optional(),
        relation: z.string().optional(),
      })
      .parse(req.body);

    const resident = await prisma.coResident.findFirst({
      where: {
        id: req.params.cid,
        leaseId: req.params.id,
        tenant: { organizationId: req.organizationId! },
      },
    });
    if (!resident) throw new HttpError(404, '同住人不存在');

    ok(
      res,
      await prisma.coResident.update({
        where: { id: req.params.cid },
        data: input,
        include: { tenant: true },
      })
    );
  })
);

leaseRouter.delete(
  '/:id/cohabitants/:cid',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const resident = await prisma.coResident.findFirst({
      where: {
        id: req.params.cid,
        leaseId: req.params.id,
        tenant: { organizationId: req.organizationId! },
      },
    });
    if (!resident) throw new HttpError(404, '同住人不存在');
    await prisma.coResident.softDelete({ where: { id: req.params.cid } });
    ok(res, { deleted: true });
  })
);

// Settlement
leaseRouter.post(
  '/:id/terminate',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        type: z.enum(['EXPIRED', 'NEGOTIATED', 'BREACH', 'FORCED']),
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

// Renew
leaseRouter.post(
  '/:id/renew',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        rentAmount: amountSchema.optional(),
        remark: z.string().optional(),
      })
      .refine((data) => data.endDate >= data.startDate, {
        path: ['endDate'],
        message: '租约结束日期不能早于开始日期',
      })
      .parse(req.body);

    const oldLease = await prisma.lease.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      include: { ...leaseInclude, tenant: true },
    });
    if (!oldLease) throw new HttpError(404, '租约不存在');
    if (oldLease.status !== 'ACTIVE')
      throw new HttpError(400, '仅有效租约可以续租');

    const newLease = await prisma.$transaction(async (tx) => {
      await tx.lease.update({
        where: { id: oldLease.id },
        data: { status: 'RENEWED' },
      });

      await tx.leaseChangeLog.create({
        data: {
          leaseId: oldLease.id,
          fieldName: 'status',
          oldValue: oldLease.status,
          newValue: 'RENEWED',
          reason: '续租',
          changedById: req.user!.id,
        },
      });

      const created = await tx.lease.create({
        data: {
          organizationId: req.organizationId!,
          roomId: oldLease.roomId,
          tenantId: oldLease.tenantId,
          tenantName: oldLease.tenantName,
          tenantPhone: oldLease.tenantPhone,
          startDate: input.startDate,
          endDate: input.endDate,
          billDay: oldLease.billDay,
          utilityBillDay: oldLease.utilityBillDay,
          paymentDueDays: oldLease.paymentDueDays,
          graceDays: oldLease.graceDays,
          cycle: oldLease.cycle,
          rentAmount: input.rentAmount ?? oldLease.rentAmount,
          depositAmount: oldLease.depositAmount,
          waterUnitPrice: oldLease.waterUnitPrice,
          powerUnitPrice: oldLease.powerUnitPrice,
          gasUnitPrice: oldLease.gasUnitPrice,
          lateFeeRate: oldLease.lateFeeRate,
          autoRenew: oldLease.autoRenew,
          signedBy: oldLease.signedBy,
          remark: input.remark,
          parentLeaseId: oldLease.id,
          status: 'ACTIVE',
          fees: {
            create: oldLease.fees.map((fee) => ({
              type: fee.type,
              name: fee.name,
              amount: fee.amount,
            })),
          },
        },
        include: leaseInclude,
      });

      if (oldLease.deposit) {
        await tx.deposit.create({
          data: {
            organizationId: req.organizationId!,
            leaseId: created.id,
            amount: oldLease.deposit.amount,
            paidAmount: oldLease.deposit.paidAmount,
            status: oldLease.deposit.status,
          },
        });
      }

      return created;
    });

    await generateLeaseBills(newLease.id, new Date());
    await populateBillQueue(newLease.id).catch(() => {});
    ok(res, withLeaseLifecycle(newLease));
  })
);

// Room change
leaseRouter.post(
  '/:id/room-change',
  requirePermission(PERMISSIONS.LEASE_MANAGE),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        newRoomId: z.string(),
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        rentAmount: amountSchema.optional(),
        remark: z.string().optional(),
      })
      .refine((data) => data.endDate >= data.startDate, {
        path: ['endDate'],
        message: '租约结束日期不能早于开始日期',
      })
      .parse(req.body);

    const oldLease = await prisma.lease.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      include: { ...leaseInclude, tenant: true, deposit: true },
    });
    if (!oldLease) throw new HttpError(404, '租约不存在');
    if (oldLease.status !== 'ACTIVE')
      throw new HttpError(400, '仅有效租约可以换房');

    const newRoom = await prisma.room.findFirst({
      where: {
        id: input.newRoomId,
        apartment: { organizationId: req.organizationId! },
      },
    });
    if (!newRoom) throw new HttpError(404, '目标房间不存在');
    if (newRoom.status !== 'VACANT')
      throw new HttpError(400, '目标房间不是空闲状态');

    const result = await prisma.$transaction(async (tx) => {
      await tx.lease.update({
        where: { id: oldLease.id },
        data: {
          status: 'TERMINATED',
          terminationType: 'NEGOTIATED',
          terminationReason: '换房',
          terminatedAt: new Date(),
        },
      });

      await tx.room.update({
        where: { id: oldLease.roomId },
        data: { status: 'CHECKOUT_CLEANING' },
      });

      const newLease = await tx.lease.create({
        data: {
          organizationId: req.organizationId!,
          roomId: input.newRoomId,
          tenantId: oldLease.tenantId,
          tenantName: oldLease.tenantName,
          tenantPhone: oldLease.tenantPhone,
          startDate: input.startDate,
          endDate: input.endDate,
          billDay: oldLease.billDay,
          utilityBillDay: oldLease.utilityBillDay,
          paymentDueDays: oldLease.paymentDueDays,
          graceDays: oldLease.graceDays,
          cycle: oldLease.cycle,
          rentAmount: input.rentAmount ?? oldLease.rentAmount,
          depositAmount: oldLease.depositAmount,
          waterUnitPrice: oldLease.waterUnitPrice,
          powerUnitPrice: oldLease.powerUnitPrice,
          gasUnitPrice: oldLease.gasUnitPrice,
          lateFeeRate: oldLease.lateFeeRate,
          autoRenew: oldLease.autoRenew,
          signedBy: oldLease.signedBy,
          remark: input.remark,
          parentLeaseId: oldLease.id,
          status: 'ACTIVE',
          fees: {
            create: oldLease.fees.map((fee) => ({
              type: fee.type,
              name: fee.name,
              amount: fee.amount,
            })),
          },
        },
        include: leaseInclude,
      });

      await tx.room.update({
        where: { id: input.newRoomId },
        data: { status: 'OCCUPIED' },
      });

      if (oldLease.deposit) {
        await tx.deposit.update({
          where: { id: oldLease.deposit.id },
          data: {
            transferredAmount: oldLease.deposit.paidAmount,
            status: 'FULLY_REFUNDED',
          },
        });
        await tx.deposit.create({
          data: {
            organizationId: req.organizationId!,
            leaseId: newLease.id,
            amount: oldLease.deposit.amount,
            paidAmount: oldLease.deposit.paidAmount,
            status: oldLease.deposit.status,
          },
        });
      }

      return newLease;
    });

    await generateLeaseBills(result.id, new Date());
    await populateBillQueue(result.id).catch(() => {});
    ok(res, withLeaseLifecycle(result));
  })
);
