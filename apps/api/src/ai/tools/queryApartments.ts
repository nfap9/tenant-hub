import { z } from 'zod';
import { PERMISSIONS } from '../../services/roles.js';
import { listApartmentsRaw } from '../../services/apartment.js';
import type { ToolMeta } from './types.js';

const input = z.object({
  keyword: z.string().optional().describe('公寓名或地址模糊匹配关键词'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('返回条数上限，默认 20'),
});

export const queryApartmentsTool: ToolMeta<z.infer<typeof input>, unknown> = {
  name: 'query_apartments',
  description:
    '查询当前组织下的公寓列表，可按名称/地址关键词模糊匹配。返回公寓基础信息与房间数量统计。',
  inputSchema: input,
  permission: PERMISSIONS.APARTMENT_VIEW,
  isWrite: false,

  async execute(inp, ctx) {
    const rows = await listApartmentsRaw(ctx.organizationId, {
      keyword: inp.keyword,
      limit: inp.limit ?? 20,
      includeRoomStats: true,
    });
    const data = rows.map((r) => ({
      id: r.id,
      name: r.name,
      address: r.address,
      rentAmount: Number(r.rentAmount),
      floors: r.floors,
      roomCount:
        '_count' in r ? (r._count as { rooms: number }).rooms : undefined,
    }));
    return {
      ok: true,
      data,
      summary: `共查询到 ${data.length} 栋公寓${inp.keyword ? `（关键词"${inp.keyword}"）` : ''}。`,
    };
  },
};
