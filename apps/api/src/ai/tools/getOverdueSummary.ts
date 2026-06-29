import { z } from 'zod';
import { PERMISSIONS } from '../../services/roles.js';
import { prisma } from '../../config/prisma.js';
import type { ToolMeta } from './types.js';

const input = z.object({
  asOf: z.coerce.date().optional().describe('统计基准日期，默认今天'),
});

export const getOverdueSummaryTool: ToolMeta<z.infer<typeof input>, unknown> = {
  name: 'get_overdue_summary',
  description:
    '统计当前组织下逾期未支付的账单汇总。返回每个租客/房间的逾期笔数、逾期天数与合计金额。',
  inputSchema: input,
  permission: PERMISSIONS.BILL_VIEW,
  isWrite: false,

  async execute(inp, ctx) {
    const asOf = inp.asOf ?? new Date();
    const bills = await prisma.bill.findMany({
      where: {
        organizationId: ctx.organizationId,
        deletedAt: null,
        status: 'UNPAID',
        dueDate: { lt: asOf },
      },
      include: {
        lease: {
          select: {
            tenantName: true,
            room: {
              select: { roomNo: true, apartment: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    const items = bills.map((b) => ({
      id: b.id,
      apartmentName: b.lease?.room?.apartment.name ?? null,
      roomNo: b.lease?.room?.roomNo ?? null,
      tenantName: b.lease?.tenantName ?? null,
      billingDate: b.billingDate,
      dueDate: b.dueDate,
      overdueDays: Math.max(
        0,
        Math.floor((asOf.getTime() - b.dueDate.getTime()) / 86_400_000)
      ),
      unpaidAmount: Number(b.totalAmount) - Number(b.paidAmount),
    }));

    const totalUnpaid = items.reduce((s, i) => s + i.unpaidAmount, 0);
    return {
      ok: true,
      data: { asOf, items, totalUnpaid, count: items.length },
      summary: `截至 ${asOf.toISOString().slice(0, 10)} 共 ${items.length} 笔逾期账单，合计未收 ¥${totalUnpaid.toFixed(2)}。`,
    };
  },
};
