import { prisma } from '../../config/prisma.js';
import { listApartmentsRaw, listRoomsRaw } from '../apartment.js';

/**
 * 获取经纪人分析汇总数据
 * @param organizationId - 组织ID
 * @returns 包含公寓、房间、租约、账单及收租率等统计指标的对象
 */
export const getAnalyticsSummaryForAgent = async (organizationId: string) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [apartments, rooms, activeLeases, monthlyBills, allBills] =
    await Promise.all([
      listApartmentsRaw(organizationId),
      listRoomsRaw(organizationId),
      prisma.lease.count({
        where: { organizationId, deletedAt: null, status: 'ACTIVE' },
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
    allBills.reduce((sum, b) => sum + Number(b._sum.totalAmount || 0), 0) || 0;
  const totalPaid =
    allBills
      .filter((b) => b.status === 'PAID')
      .reduce((sum, b) => sum + Number(b._sum.paidAmount || 0), 0) || 0;

  const unpaidBillsAmount = totalBilled - totalPaid;
  const collectionRate =
    totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 100;
  const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

  return {
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
  };
};
