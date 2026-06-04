import { prisma } from '../../config/prisma.js';

/**
 * 为智能体/客服查询组织下的押金列表，包含租约、房间、公寓信息
 * @param organizationId - 组织ID
 * @param status - 押金状态筛选（可选）
 * @param limit - 返回数量限制，默认30
 * @returns 押金列表，包含租客姓名、房间号、公寓名、金额及状态等
 */
export const queryDepositsForAgent = async ({
  organizationId,
  status,
  limit = 30,
}: {
  organizationId: string;
  status?:
    | 'UNPAID'
    | 'PAID'
    | 'PARTIAL_REFUNDED'
    | 'FULLY_REFUNDED'
    | 'DEDUCTED';
  limit?: number;
}) => {
  const deposits = await prisma.deposit.findMany({
    where: {
      organizationId,
      ...(status ? { status } : {}),
    },
    include: {
      lease: {
        include: {
          room: { include: { apartment: { select: { name: true } } } },
        },
      },
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  return deposits.map((d) => ({
    id: d.id,
    tenantName: d.lease.tenantName,
    roomNo: d.lease.room.roomNo,
    apartmentName: d.lease.room.apartment.name,
    amount: Number(d.amount),
    paidAmount: Number(d.paidAmount),
    refundedAmount: Number(d.refundedAmount),
    deductedAmount: Number(d.deductedAmount),
    status: d.status,
    createdAt: d.createdAt.toISOString().split('T')[0],
  }));
};

/**
 * 为智能体/客服查询组织下的押金汇总数据，包含各状态数量分布
 * @param organizationId - 组织ID
 * @returns 押金汇总数据，包括金额统计、总数及各状态分布
 */
export const queryDepositSummaryForAgent = async (organizationId: string) => {
  const deposits = await prisma.deposit.findMany({
    where: { organizationId },
  });

  const totalAmount = deposits.reduce((sum, d) => sum + Number(d.amount), 0);
  const paidAmount = deposits.reduce((sum, d) => sum + Number(d.paidAmount), 0);
  const refundedAmount = deposits.reduce(
    (sum, d) => sum + Number(d.refundedAmount),
    0
  );
  const deductedAmount = deposits.reduce(
    (sum, d) => sum + Number(d.deductedAmount),
    0
  );
  const heldAmount = paidAmount - refundedAmount - deductedAmount;

  const byStatus: Record<string, number> = {};
  for (const d of deposits) {
    byStatus[d.status] = (byStatus[d.status] || 0) + 1;
  }

  return {
    totalAmount: Number(totalAmount.toFixed(2)),
    paidAmount: Number(paidAmount.toFixed(2)),
    refundedAmount: Number(refundedAmount.toFixed(2)),
    deductedAmount: Number(deductedAmount.toFixed(2)),
    heldAmount: Number(heldAmount.toFixed(2)),
    totalCount: deposits.length,
    byStatus,
  };
};
