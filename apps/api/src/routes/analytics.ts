import { Router } from 'express';
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from '../middleware/auth.js';
import { PERMISSIONS } from '../services/roles.js';
import { listApartmentsRaw, listRoomsRaw } from '../services/apartment.js';
import { prisma } from '../config/prisma.js';

export const analyticsRouter = Router();

analyticsRouter.get(
  '/summary',
  requireAuth,
  requireOrg,
  requirePermission(PERMISSIONS.APARTMENT_VIEW),
  async (req, res, next) => {
    try {
      const organizationId = req.organizationId!;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const [apartments, rooms, activeLeases, monthlyBills, allBills] =
        await Promise.all([
          listApartmentsRaw(organizationId),
          listRoomsRaw(organizationId),
          prisma.lease.count({
            where: {
              organizationId,
              deletedAt: null,
              status: 'ACTIVE',
            },
          }),
          prisma.bill.groupBy({
            by: ['status'],
            where: {
              organizationId,
              deletedAt: null,
              billingDate: { gte: startOfMonth, lt: endOfMonth },
            },
            _sum: { totalAmount: true, paidAmount: true },
          }),
          prisma.bill.groupBy({
            by: ['status'],
            where: { organizationId, deletedAt: null },
            _sum: { totalAmount: true, paidAmount: true },
          }),
        ]);

      const totalApartments = apartments.length;
      const totalRooms = rooms.length;
      const occupiedRooms = rooms.filter((r) => r.status === 'OCCUPIED').length;
      const vacantRooms = rooms.filter((r) => r.status === 'VACANT').length;
      const monthlyRentIncome =
        monthlyBills
          .filter((b) => b.status === 'PAID')
          .reduce((sum, b) => sum + Number(b._sum.paidAmount || 0), 0) || 0;
      const totalBilled =
        allBills.reduce((sum, b) => sum + Number(b._sum.totalAmount || 0), 0) ||
        0;
      const totalPaid =
        allBills
          .filter((b) => b.status === 'PAID')
          .reduce((sum, b) => sum + Number(b._sum.paidAmount || 0), 0) || 0;

      res.json({
        totalApartments,
        totalRooms,
        occupiedRooms,
        vacantRooms,
        occupancyRate:
          totalRooms > 0
            ? Number(((occupiedRooms / totalRooms) * 100).toFixed(2))
            : 0,
        activeLeases,
        monthlyRentIncome: Number(monthlyRentIncome.toFixed(2)),
        unpaidBillsAmount: Number((totalBilled - totalPaid).toFixed(2)),
        paidBillsAmount: Number(totalPaid.toFixed(2)),
        collectionRate:
          totalBilled > 0
            ? Number(((totalPaid / totalBilled) * 100).toFixed(2))
            : 100,
      });
    } catch (err) {
      next(err);
    }
  }
);
