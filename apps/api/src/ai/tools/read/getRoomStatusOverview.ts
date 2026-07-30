import { z } from 'zod';
import { PERMISSIONS } from '../../../services/roles.js';
import { prisma } from '../../../config/prisma.js';
import type { ToolMeta } from '../types.js';

const input = z.object({
  apartmentId: z.string().optional().describe('按公寓筛选，不传则统计整个组织'),
});

const statusLabels: Record<string, string> = {
  VACANT: '空置',
  OCCUPIED: '已出租',
  MAINTENANCE: '维修中',
  SELF_USE: '自住',
};

export const getRoomStatusOverviewTool: ToolMeta<
  z.infer<typeof input>,
  unknown
> = {
  name: 'get_room_status_overview',
  description:
    '统计当前组织（或指定公寓）的房间状态分布，包括空置、已出租、维修中、自住数量与出租率。',
  inputSchema: input,
  permission: PERMISSIONS.ROOM_VIEW,
  isWrite: false,

  async execute(inp, ctx) {
    if (inp.apartmentId) {
      const apartment = await prisma.apartment.findFirst({
        where: { id: inp.apartmentId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!apartment) {
        return {
          ok: false,
          error: '公寓不存在',
          summary: '查询失败：指定的公寓不存在或不在当前组织内。',
        };
      }
    }

    const groups = await prisma.room.groupBy({
      by: ['status'],
      where: {
        deletedAt: null,
        apartment: { organizationId: ctx.organizationId },
        ...(inp.apartmentId ? { apartmentId: inp.apartmentId } : {}),
      },
      _count: { status: true },
    });

    const counts = groups.reduce<Record<string, number>>((acc, g) => {
      acc[g.status] = g._count.status;
      return acc;
    }, {});

    const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
    const occupied = counts.OCCUPIED ?? 0;
    const occupancyRate =
      total > 0 ? ((occupied / total) * 100).toFixed(1) : '0.0';

    const scopeText = inp.apartmentId ? '该公寓' : '当前组织';
    const detail = ['VACANT', 'OCCUPIED', 'MAINTENANCE', 'SELF_USE']
      .map((s) => `${statusLabels[s]} ${counts[s] ?? 0} 间`)
      .join('，');

    return {
      ok: true,
      data: { total, counts, occupancyRate: Number(occupancyRate) },
      summary: `${scopeText}共有房间 ${total} 间（${detail}），出租率 ${occupancyRate}%。`,
    };
  },
};
