import { Router } from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireOrg } from '../middleware/auth.js';
import {
  getCurrentMonthBillWindow,
  getBillMonthLabel,
} from '../services/billing.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/http.js';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth, requireOrg);

dashboardRouter.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const orgId = req.organizationId!;
    const currentMonthBillWindow = getCurrentMonthBillWindow();

    const [apartmentCount, roomCount, activeLeases, overdueBills] =
      await Promise.all([
        prisma.apartment.count({
          where: { organizationId: orgId, deletedAt: null },
        }),
        prisma.room.count({
          where: { apartment: { organizationId: orgId } },
        }),
        prisma.lease.count({
          where: { organizationId: orgId, status: 'ACTIVE' },
        }),
        prisma.bill.aggregate({
          where: {
            organizationId: orgId,
            status: 'OVERDUE',
          },
          _sum: { totalAmount: true, paidAmount: true },
        }),
      ]);

    const currentMonthBills = await prisma.bill.findMany({
      where: {
        organizationId: orgId,
        billingDate: {
          gte: currentMonthBillWindow.start,
          lt: currentMonthBillWindow.end,
        },
      },
      select: { totalAmount: true, paidAmount: true, status: true },
    });

    const monthReceivable = currentMonthBills.reduce(
      (s, b) => s + Number(b.totalAmount),
      0
    );
    const monthReceived = currentMonthBills.reduce(
      (s, b) => s + Number(b.paidAmount),
      0
    );

    ok(res, {
      apartmentCount,
      roomCount,
      occupiedCount: activeLeases,
      vacancyCount: roomCount - activeLeases,
      occupancyRate:
        roomCount > 0
          ? Number(((activeLeases / roomCount) * 100).toFixed(2))
          : 0,
      currentMonth: {
        label: getBillMonthLabel(currentMonthBillWindow.start),
        receivable: monthReceivable,
        received: monthReceived,
        overdueBalance:
          Number(overdueBills._sum.totalAmount ?? 0) -
          Number(overdueBills._sum.paidAmount ?? 0),
      },
    });
  })
);

dashboardRouter.get(
  '/todos',
  asyncHandler(async (req, res) => {
    const orgId = req.organizationId!;
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [expiringLeases, overdueBills, pendingMaintenance] =
      await Promise.all([
        prisma.lease.findMany({
          where: {
            organizationId: orgId,
            status: 'ACTIVE',
            endDate: { lte: in30Days, gte: now },
          },
          include: {
            room: { select: { roomNo: true } },
            tenant: { select: { name: true, phone: true } },
          },
          orderBy: { endDate: 'asc' },
          take: 10,
        }),
        prisma.bill.findMany({
          where: {
            organizationId: orgId,
            status: 'OVERDUE',
          },
          include: {
            lease: {
              select: {
                tenantName: true,
                room: { select: { roomNo: true } },
              },
            },
          },
          orderBy: { dueDate: 'asc' },
          take: 10,
        }),
        prisma.maintenanceOrder
          ? prisma.maintenanceOrder.count({
              where: {
                organizationId: orgId,
                status: { notIn: ['COMPLETED', 'CANCELLED'] },
              },
            })
          : Promise.resolve(0),
      ]);

    ok(res, {
      expiringLeases: expiringLeases.map((l) => ({
        id: l.id,
        tenantName: l.tenantName,
        roomNo: l.room.roomNo,
        endDate: l.endDate,
      })),
      overdueBills: overdueBills.map((b) => ({
        id: b.id,
        tenantName: b.lease?.tenantName ?? '',
        roomNo: b.lease?.room?.roomNo ?? '',
        totalAmount: b.totalAmount,
        paidAmount: b.paidAmount,
        dueDate: b.dueDate,
      })),
      pendingMaintenanceCount: pendingMaintenance,
    });
  })
);

dashboardRouter.get(
  '/recent-activities',
  asyncHandler(async (req, res) => {
    const orgId = req.organizationId!;
    const [recentLeases, recentPayments, recentMaintenance] = await Promise.all(
      [
        prisma.lease.findMany({
          where: { organizationId: orgId },
          include: { room: { select: { roomNo: true } } },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        prisma.payment.findMany({
          where: { bill: { organizationId: orgId } },
          include: {
            bill: { select: { lease: { select: { tenantName: true } } } },
          },
          orderBy: { paidAt: 'desc' },
          take: 5,
        }),
        prisma.maintenanceOrder.findMany({
          where: { organizationId: orgId },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ]
    );

    ok(res, {
      recentSignings: recentLeases.map((l) => ({
        id: l.id,
        tenantName: l.tenantName,
        roomNo: l.room.roomNo,
        createdAt: l.createdAt,
        type: 'LEASE_CREATED',
      })),
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        tenantName: p.bill?.lease?.tenantName ?? '',
        amount: p.amount,
        paidAt: p.paidAt,
        type: 'PAYMENT_RECEIVED',
      })),
      recentMaintenance: recentMaintenance.map((m) => ({
        id: m.id,
        title: m.title,
        status: m.status,
        createdAt: m.createdAt,
        type: 'MAINTENANCE_CREATED',
      })),
    });
  })
);
