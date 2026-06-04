import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { queryApartmentsForAgent } from '../../services/forAgent/apartment.js';
import type { AgentContext } from '../types.js';

export const queryApartmentsTool = (ctx: AgentContext) =>
  tool(
    async ({ keyword, limit = 20 }) => {
      const apartments = await queryApartmentsForAgent({
        organizationId: ctx.organizationId,
        keyword,
        limit,
      });

      return JSON.stringify(apartments);
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
