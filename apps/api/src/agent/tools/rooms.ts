import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { queryRoomsForAgent } from '../../services/forAgent/apartment.js';
import type { AgentContext } from '../types.js';

export const queryRoomsTool = (ctx: AgentContext) =>
  tool(
    async ({ apartmentId, status, keyword, limit = 30 }) => {
      const rooms = await queryRoomsForAgent({
        organizationId: ctx.organizationId,
        apartmentId,
        status,
        keyword,
        limit,
      });

      return JSON.stringify(rooms);
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
