import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import type { AgentContext } from '../types.js';

export const queryApartmentsTool = (ctx: AgentContext) =>
  tool(
    async ({ keyword, limit = 20 }) => {
      const apartments = await prisma.apartment.findMany({
        where: {
          organizationId: ctx.organizationId,
          deletedAt: null,
          ...(keyword
            ? {
                OR: [
                  { name: { contains: keyword, mode: 'insensitive' } },
                  { location: { contains: keyword, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        include: {
          _count: { select: { rooms: { where: { deletedAt: null } } } },
          rooms: {
            where: { deletedAt: null },
            select: { status: true },
          },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      return JSON.stringify(
        apartments.map((apt) => ({
          id: apt.id,
          name: apt.name,
          location: apt.location,
          roomCount: apt._count.rooms,
          occupiedCount: apt.rooms.filter((r) => r.status === 'OCCUPIED')
            .length,
          vacantCount: apt.rooms.filter((r) => r.status === 'VACANT').length,
        }))
      );
    },
    {
      name: 'query_apartments',
      description:
        '查询公寓列表。返回公寓ID、名称、位置、房间总数、已租数量、空置数量。',
      schema: z.object({
        keyword: z
          .string()
          .optional()
          .describe('按名称或位置关键词筛选（可选）'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe('返回数量限制，默认20'),
      }),
    }
  );
