import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { querySettlementsForAgent } from '../../services/lease.js';
import type { AgentContext } from '../types.js';

export const querySettlementsTool = (ctx: AgentContext) =>
  tool(
    async ({ leaseId, limit = 30 }) => {
      const settlements = await querySettlementsForAgent({
        organizationId: ctx.organizationId,
        leaseId,
        limit,
      });

      return JSON.stringify(settlements);
    },
    {
      name: 'query_settlements',
      description:
        '查询退租结算记录，包括结算类型、各项费用（租金调整、其他费用、违约金、赔偿金）、押金退还和实收金额。',
      schema: z.object({
        leaseId: z.string().optional().describe('按租约ID筛选（可选）'),
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
