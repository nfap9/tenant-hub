import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from '../middleware/auth.js';
import { PERMISSIONS } from '../services/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/http.js';

export const reportRouter = Router();
reportRouter.use(requireAuth, requireOrg);

// US-1101: 应收应付报表
reportRouter.get(
  '/receivables',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const { apartmentId, status } = z
      .object({
        apartmentId: z.string().optional(),
        status: z
          .enum(['UNPAID', 'PARTIAL_PAID', 'OVERDUE', 'PAID'])
          .optional(),
      })
      .parse(req.query);

    const bills = await prisma.bill.findMany({
      where: {
        organizationId: req.organizationId!,
        ...(status
          ? { status }
          : { status: { in: ['UNPAID', 'PARTIAL_PAID', 'OVERDUE'] } }),
        ...(apartmentId ? { lease: { room: { apartmentId } } } : {}),
      },
      include: {
        lease: {
          include: { room: { include: { apartment: true } }, tenant: true },
        },
        items: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    const totalReceivable = bills.reduce(
      (sum, b) => sum + Number(b.totalAmount),
      0
    );
    const totalReceived = bills.reduce(
      (sum, b) => sum + Number(b.paidAmount),
      0
    );
    const totalUnpaid = totalReceivable - totalReceived;

    ok(res, {
      bills,
      summary: { totalReceivable, totalReceived, totalUnpaid },
    });
  })
);

// US-1102: 收支报表
reportRouter.get(
  '/income-expense',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const { year, month, apartmentId } = z
      .object({
        year: z.coerce.number().int(),
        month: z.coerce.number().int().min(1).max(12).optional(),
        apartmentId: z.string().optional(),
      })
      .parse(req.query);

    const startDate = month
      ? new Date(year, month - 1, 1)
      : new Date(year, 0, 1);
    const endDate = month ? new Date(year, month, 1) : new Date(year + 1, 0, 1);

    // 收入：已收账单
    const incomeBills = await prisma.bill.findMany({
      where: {
        organizationId: req.organizationId!,
        status: { in: ['PAID', 'PARTIAL_PAID'] },
        ...(apartmentId ? { lease: { room: { apartmentId } } } : {}),
      },
      include: {
        lease: { include: { room: { include: { apartment: true } } } },
        items: true,
      },
    });

    // 支出：公寓费用
    const expenses = await prisma.apartmentExpense.findMany({
      where: {
        apartment: { organizationId: req.organizationId! },
        spentAt: { gte: startDate, lt: endDate },
        deletedAt: null,
        ...(apartmentId ? { apartmentId } : {}),
      },
      include: { apartment: true, category: true },
    });

    const incomeByCategory: Record<string, number> = {};
    for (const bill of incomeBills) {
      for (const item of bill.items) {
        const key = item.name;
        incomeByCategory[key] =
          (incomeByCategory[key] ?? 0) + Number(item.amount);
      }
    }

    const expenseByCategory: Record<string, number> = {};
    for (const e of expenses) {
      const key = e.category?.name ?? e.name;
      expenseByCategory[key] = (expenseByCategory[key] ?? 0) + Number(e.amount);
    }

    const totalIncome = Object.values(incomeByCategory).reduce(
      (a, b) => a + b,
      0
    );
    const totalExpense = Object.values(expenseByCategory).reduce(
      (a, b) => a + b,
      0
    );

    ok(res, {
      period: { startDate, endDate },
      income: { total: totalIncome, byCategory: incomeByCategory },
      expense: { total: totalExpense, byCategory: expenseByCategory },
      grossProfit: totalIncome - totalExpense,
    });
  })
);

// US-1103: 收缴率分析
reportRouter.get(
  '/collection-rate',
  requirePermission(PERMISSIONS.BILL_VIEW),
  asyncHandler(async (req, res) => {
    const { year, month } = z
      .object({
        year: z.coerce.number().int(),
        month: z.coerce.number().int().min(1).max(12),
      })
      .parse(req.query);

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const bills = await prisma.bill.findMany({
      where: {
        organizationId: req.organizationId!,
        billingDate: { gte: startDate, lt: endDate },
      },
      include: {
        lease: {
          include: { room: { include: { apartment: true } }, tenant: true },
        },
      },
    });

    const totalReceivable = bills.reduce(
      (sum, b) => sum + Number(b.totalAmount),
      0
    );
    const totalReceived = bills.reduce(
      (sum, b) => sum + Number(b.paidAmount),
      0
    );
    const collectionRate =
      totalReceivable > 0
        ? Number(((totalReceived / totalReceivable) * 100).toFixed(2))
        : 0;

    // 欠费租客
    const overdueTenants = bills
      .filter(
        (b) =>
          b.status === 'OVERDUE' ||
          (b.totalAmount > b.paidAmount && b.status !== 'PAID')
      )
      .map((b) => ({
        tenantName: b.lease.tenantName,
        roomNo: b.lease.room.roomNo,
        apartmentName: b.lease.room.apartment.name,
        amount: Number(b.totalAmount) - Number(b.paidAmount),
      }));

    ok(res, {
      period: { year, month },
      totalReceivable,
      totalReceived,
      collectionRate,
      overdueTenants,
    });
  })
);

// US-1104: 入住率分析
reportRouter.get(
  '/occupancy',
  requirePermission(PERMISSIONS.APARTMENT_VIEW),
  asyncHandler(async (req, res) => {
    const apartments = await prisma.apartment.findMany({
      where: { organizationId: req.organizationId! },
      include: {
        rooms: {
          include: {
            leases: {
              where: { status: { in: ['ACTIVE', 'PENDING'] } },
            },
          },
        },
      },
    });

    let totalRooms = 0;
    let occupiedRooms = 0;
    const byApartment = [];

    for (const apt of apartments) {
      const aptTotal = apt.rooms.length;
      const aptOccupied = apt.rooms.filter((r) =>
        r.leases.some((l) => l.status === 'ACTIVE')
      ).length;
      totalRooms += aptTotal;
      occupiedRooms += aptOccupied;
      byApartment.push({
        apartmentId: apt.id,
        apartmentName: apt.name,
        totalRooms: aptTotal,
        occupiedRooms: aptOccupied,
        occupancyRate:
          aptTotal > 0
            ? Number(((aptOccupied / aptTotal) * 100).toFixed(2))
            : 0,
      });
    }

    ok(res, {
      totalRooms,
      occupiedRooms,
      vacantRooms: totalRooms - occupiedRooms,
      overallOccupancyRate:
        totalRooms > 0
          ? Number(((occupiedRooms / totalRooms) * 100).toFixed(2))
          : 0,
      byApartment,
    });
  })
);
