import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { queryLeasesForAgent } from '../../services/forAgent/lease.js';
import type { AgentContext } from '../types.js';

export const queryLeasesTool = (ctx: AgentContext) =>
  tool(
    async ({ tenantName, roomId, status, limit = 30 }) => {
      const leases = await queryLeasesForAgent({
        organizationId: ctx.organizationId,
        tenantName,
        roomId,
        status,
        limit,
      });

      return JSON.stringify(leases);
    },
    {
      name: 'query_leases',
      description:
        '查询租约列表。返回租约ID、租户姓名、手机号、房间号、公寓名、起止日期、月租金、押金、状态、周期。',
      schema: z.object({
        tenantName: z
          .string()
          .optional()
          .describe('按租户姓名关键词筛选（可选）'),
        roomId: z.string().optional().describe('按房间ID筛选（可选）'),
        status: z
          .enum(['ACTIVE', 'TERMINATED', 'EXPIRED', 'DRAFT'])
          .optional()
          .describe('按状态筛选'),
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
