import { z } from 'zod';
import { PERMISSIONS } from '../../../services/roles.js';
import { prisma } from '../../../config/prisma.js';
import type { ToolMeta } from '../types.js';

const input = z.object({
  apartmentId: z.string().optional().describe('按公寓筛选'),
  status: z
    .enum(['VACANT', 'OCCUPIED', 'MAINTENANCE', 'SELF_USE'])
    .optional()
    .describe('房间状态'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('返回条数上限，默认 50'),
});

export const queryRoomsTool: ToolMeta<z.infer<typeof input>, unknown> = {
  name: 'query_rooms',
  description:
    '查询当前组织下的房间列表，可按公寓、状态筛选。返回房间号、楼层、面积、布局、状态等。',
  inputSchema: input,
  permission: PERMISSIONS.ROOM_VIEW,
  isWrite: false,

  async execute(inp, ctx) {
    const rooms = await prisma.room.findMany({
      where: {
        deletedAt: null,
        apartment: { organizationId: ctx.organizationId },
        ...(inp.apartmentId ? { apartmentId: inp.apartmentId } : {}),
        ...(inp.status ? { status: inp.status } : {}),
      },
      include: {
        apartment: { select: { name: true } },
        leases: {
          where: { status: 'ACTIVE' },
          select: { tenantName: true, tenantPhone: true, endDate: true },
          take: 1,
        },
      },
      take: inp.limit ?? 50,
      orderBy: { roomNo: 'asc' },
    });
    const data = rooms.map((r) => ({
      id: r.id,
      apartmentName: r.apartment.name,
      roomNo: r.roomNo,
      floor: r.floor,
      layout: r.layout,
      area: r.area ? Number(r.area) : null,
      status: r.status,
      activeTenant: r.leases[0]?.tenantName ?? null,
    }));
    return {
      ok: true,
      data,
      summary: `共查询到 ${data.length} 间房间。`,
    };
  },
};
