import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import type { AgentContext } from '../types.js';

export const queryRoomsTool = (ctx: AgentContext) =>
  tool(
    async ({ apartmentId, status, keyword, limit = 30 }) => {
      const rooms = await prisma.room.findMany({
        where: {
          apartment: { organizationId: ctx.organizationId },
          deletedAt: null,
          ...(apartmentId ? { apartmentId } : {}),
          ...(status ? { status } : {}),
          ...(keyword
            ? {
                OR: [
                  { roomNo: { contains: keyword, mode: 'insensitive' } },
                  { layout: { contains: keyword, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        include: { apartment: { select: { name: true } } },
        take: limit,
        orderBy: [{ apartment: { createdAt: 'desc' } }, { roomNo: 'asc' }],
      });

      return JSON.stringify(
        rooms.map((room) => ({
          id: room.id,
          roomNo: room.roomNo,
          apartmentName: room.apartment.name,
          layout: room.layout,
          status: room.status,
          area: room.area ? Number(room.area) : null,
          facilities: room.facilities,
        }))
      );
    },
    {
      name: 'query_rooms',
      description:
        '查询房间列表。返回房间ID、房号、所属公寓、户型、状态、面积、配套设施。',
      schema: z.object({
        apartmentId: z.string().optional().describe('按公寓ID筛选（可选）'),
        status: z
          .enum(['VACANT', 'RESERVED', 'OCCUPIED', 'MAINTENANCE'])
          .optional()
          .describe(
            '按状态筛选：VACANT空闲/RESERVED已预留/OCCUPIED已出租/MAINTENANCE维修中'
          ),
        keyword: z
          .string()
          .optional()
          .describe('按房号或户型关键词筛选（可选）'),
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
