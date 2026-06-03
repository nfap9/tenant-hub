import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import type { AgentContext } from '../types.js';

export const analyticsSummaryTool = (ctx: AgentContext) =>
  tool(
    async () => {
      const orgId = ctx.organizationId;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const [
        totalApartments,
        totalRooms,
        occupiedRooms,
        vacantRooms,
        activeLeases,
        monthlyBills,
        allBills,
      ] = await Promise.all([
        prisma.apartment.count({
          where: { organizationId: orgId, deletedAt: null },
        }),
        prisma.room.count({
          where: { apartment: { organizationId: orgId }, deletedAt: null },
        }),
        prisma.room.count({
          where: {
            apartment: { organizationId: orgId },
            deletedAt: null,
            status: 'OCCUPIED',
          },
        }),
        prisma.room.count({
          where: {
            apartment: { organizationId: orgId },
            deletedAt: null,
            status: 'VACANT',
          },
        }),
        prisma.lease.count({
          where: { organizationId: orgId, deletedAt: null, status: 'ACTIVE' },
        }),
        prisma.bill.groupBy({
          by: ['status'],
          where: {
            organizationId: orgId,
            deletedAt: null,
            billingDate: { gte: startOfMonth, lt: endOfMonth },
          },
          _sum: { totalAmount: true, paidAmount: true },
        }),
        prisma.bill.groupBy({
          by: ['status'],
          where: { organizationId: orgId, deletedAt: null },
          _sum: { totalAmount: true, paidAmount: true },
        }),
      ]);

      const monthlyRentIncome =
        monthlyBills
          .filter((b) => b.status === 'PAID' || b.status === 'PARTIAL_PAID')
          .reduce((sum, b) => sum + Number(b._sum.paidAmount || 0), 0) || 0;

      const totalBilled =
        allBills.reduce((sum, b) => sum + Number(b._sum.totalAmount || 0), 0) ||
        0;
      const totalPaid =
        allBills
          .filter((b) => b.status === 'PAID' || b.status === 'PARTIAL_PAID')
          .reduce((sum, b) => sum + Number(b._sum.paidAmount || 0), 0) || 0;

      const unpaidBillsAmount = totalBilled - totalPaid;
      const collectionRate =
        totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 100;
      const occupancyRate =
        totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

      return JSON.stringify({
        totalApartments,
        totalRooms,
        occupiedRooms,
        vacantRooms,
        occupancyRate: Number(occupancyRate.toFixed(2)),
        activeLeases,
        monthlyRentIncome: Number(monthlyRentIncome.toFixed(2)),
        unpaidBillsAmount: Number(unpaidBillsAmount.toFixed(2)),
        paidBillsAmount: Number(totalPaid.toFixed(2)),
        collectionRate: Number(collectionRate.toFixed(2)),
      });
    },
    {
      name: 'analytics_summary',
      description:
        '获取当前组织的经营数据汇总，包括：公寓数、房间数、空置率、活跃租约数、本月租金收入、未收金额、总收缴率。不需要参数。',
      schema: z.object({}),
    }
  );
