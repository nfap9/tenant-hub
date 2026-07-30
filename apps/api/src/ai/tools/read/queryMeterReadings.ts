import { z } from 'zod';
import { PERMISSIONS } from '../../../services/roles.js';
import { listMeterReadings } from '../../../services/bill.js';
import type { ToolMeta } from '../types.js';

const input = z.object({
  roomId: z.string().optional().describe('按房间筛选'),
  apartmentId: z.string().optional().describe('按公寓筛选'),
  meterType: z.enum(['WATER', 'POWER']).optional().describe('表类型'),
  startDate: z.coerce.date().optional().describe('起始日期'),
  endDate: z.coerce.date().optional().describe('结束日期'),
});

export const queryMeterReadingsTool: ToolMeta<
  z.infer<typeof input>,
  unknown
> = {
  name: 'query_meter_readings',
  description:
    '查询当前组织下的水电抄表记录，可按房间、公寓、表类型、日期范围筛选。',
  inputSchema: input,
  permission: PERMISSIONS.BILL_VIEW,
  isWrite: false,

  async execute(inp, ctx) {
    const rows = await listMeterReadings(ctx.organizationId, {
      roomId: inp.roomId,
      apartmentId: inp.apartmentId,
      meterType: inp.meterType,
      startDate: inp.startDate,
      endDate: inp.endDate,
    });
    const data = rows.map((r) => ({
      id: r.id,
      apartmentName: r.apartment?.name ?? null,
      roomNo: r.room?.roomNo ?? null,
      meterType: r.meterType,
      readingDate: r.readingDate,
      value: Number(r.value),
      note: r.note,
    }));
    return {
      ok: true,
      data,
      summary: `共查询到 ${data.length} 条抄表记录。`,
    };
  },
};
