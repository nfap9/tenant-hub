import { z } from 'zod';
import { PERMISSIONS } from '../../../services/roles.js';
import {
  findRoomForMeterReading,
  recordRoomMeterReading,
} from '../../../services/bill.js';
import { prisma } from '../../../config/prisma.js';
import type { ToolMeta } from '../types.js';

const input = z.object({
  roomId: z.string().describe('房间ID'),
  readingDate: z.coerce.date().describe('抄表日期 YYYY-MM-DD'),
  waterValue: z.coerce.number().nonnegative().describe('水表读数'),
  powerValue: z.coerce.number().nonnegative().describe('电表读数'),
  note: z.string().optional().describe('备注'),
});

type Input = z.infer<typeof input>;

const findLastReadings = async (roomId: string, organizationId: string) => {
  const [water, power] = await Promise.all([
    prisma.meterReading.findFirst({
      where: { roomId, organizationId, meterType: 'WATER' },
      orderBy: { readingDate: 'desc' },
    }),
    prisma.meterReading.findFirst({
      where: { roomId, organizationId, meterType: 'POWER' },
      orderBy: { readingDate: 'desc' },
    }),
  ]);
  return { water, power };
};

export const recordMeterReadingTool: ToolMeta<Input, unknown> = {
  name: 'record_meter_reading',
  description:
    '录入指定房间的水电抄表读数，系统会自动计算用量并合并到当期后付费账单。这是写操作，会生成待确认动作，用户确认后才会真正落库。',
  inputSchema: input,
  permission: PERMISSIONS.BILL_MANAGE,
  isWrite: true,

  async preview(inp, ctx) {
    const room = await findRoomForMeterReading(inp.roomId, ctx.organizationId);
    if (!room) throw new Error('房间不存在');
    const last = await findLastReadings(room.id, ctx.organizationId);
    return {
      title: `录入抄表 · ${room.apartment.name} ${room.roomNo}`,
      riskLevel: 'medium',
      diff: [
        { field: '抄表日期', newValue: inp.readingDate },
        {
          field: '水表读数',
          oldValue: last.water ? Number(last.water.value) : undefined,
          newValue: inp.waterValue,
        },
        {
          field: '电表读数',
          oldValue: last.power ? Number(last.power.value) : undefined,
          newValue: inp.powerValue,
        },
      ],
      description:
        '将创建一条水电抄表记录，并自动按用量更新该房间待出账的后付费账单金额。',
    };
  },

  async execute(inp, ctx) {
    const result = await recordRoomMeterReading({
      organizationId: ctx.organizationId,
      roomId: inp.roomId,
      readingDate: inp.readingDate,
      waterValue: inp.waterValue,
      powerValue: inp.powerValue,
      note: inp.note,
    });
    const roomLabel = `${result.room.apartment.name} ${result.room.roomNo}`;
    return {
      ok: true,
      data: {
        waterReadingId: result.waterReading.id,
        powerReadingId: result.powerReading.id,
        pendingBillCompletedCount: result.completedBillIds.length,
      },
      summary: `已录入 ${roomLabel} 抄表（水 ${inp.waterValue} / 电 ${inp.powerValue}），触发 ${result.completedBillIds.length} 笔待出账账单补全。`,
    };
  },
};
