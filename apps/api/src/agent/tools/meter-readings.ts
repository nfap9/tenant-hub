import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import type { AgentContext } from '../types.js';

export const queryMeterReadingsTool = (ctx: AgentContext) =>
  tool(
    async ({ roomId, meterType, limit = 30 }) => {
      const readings = await prisma.meterReading.findMany({
        where: {
          organizationId: ctx.organizationId,
          ...(roomId ? { roomId } : {}),
          ...(meterType ? { meterType } : {}),
        },
        include: {
          room: {
            select: {
              roomNo: true,
              apartment: { select: { name: true } },
            },
          },
          createdBy: { select: { username: true } },
        },
        take: limit,
        orderBy: { readingDate: 'desc' },
      });

      return JSON.stringify(
        readings.map((r) => ({
          id: r.id,
          roomNo: r.room.roomNo,
          apartmentName: r.room.apartment.name,
          meterType: r.meterType,
          readingDate: r.readingDate.toISOString().split('T')[0],
          value: Number(r.value),
          source: r.source,
          status: r.status,
          note: r.note,
          createdBy: r.createdBy?.username ?? null,
        }))
      );
    },
    {
      name: 'query_meter_readings',
      description:
        '查询水电抄表记录。返回房间、类型（水/电）、抄表日期、读数、来源、状态。',
      schema: z.object({
        roomId: z.string().optional().describe('按房间ID筛选（可选）'),
        meterType: z
          .enum(['WATER', 'POWER'])
          .optional()
          .describe('类型：WATER水表/POWER电表'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe('返回数量限制，默认30'),
      }),
    }
  );
