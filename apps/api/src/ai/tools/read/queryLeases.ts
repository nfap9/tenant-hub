import { z } from 'zod';
import { PERMISSIONS } from '../../../services/roles.js';
import { listLeasesRaw } from '../../../services/lease.js';
import type { ToolMeta } from '../types.js';

const input = z.object({
  status: z
    .enum(['DRAFT', 'ACTIVE', 'TERMINATED', 'EXPIRED'])
    .optional()
    .describe('租约状态'),
  tenantName: z.string().optional().describe('租客姓名模糊匹配'),
  roomId: z.string().optional().describe('按房间筛选'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('返回条数上限，默认 20'),
});

export const queryLeasesTool: ToolMeta<z.infer<typeof input>, unknown> = {
  name: 'query_leases',
  description:
    '查询当前组织下的租约列表，可按状态、租客姓名、房间筛选。返回租客、租期、租金、水电单价等。',
  inputSchema: input,
  permission: PERMISSIONS.LEASE_VIEW,
  isWrite: false,

  async execute(inp, ctx) {
    const rows = await listLeasesRaw(ctx.organizationId, {
      tenantName: inp.tenantName,
      roomId: inp.roomId,
      status: inp.status,
      limit: inp.limit ?? 20,
    });
    const data = rows.map((l) => ({
      id: l.id,
      apartmentName: l.room.apartment.name,
      roomNo: l.room.roomNo,
      tenantName: l.tenantName,
      tenantPhone: l.tenantPhone,
      startDate: l.startDate,
      endDate: l.endDate,
      rentAmount: Number(l.rentAmount),
      rentCycle: l.rentCycle,
      waterUnitPrice: Number(l.waterUnitPrice),
      powerUnitPrice: Number(l.powerUnitPrice),
      status: l.status,
    }));
    return {
      ok: true,
      data,
      summary: `共查询到 ${data.length} 条租约。`,
    };
  },
};
