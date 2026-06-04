import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  queryDepositsForAgent,
  queryDepositSummaryForAgent,
} from '../../services/deposit.js';
import type { AgentContext } from '../types.js';

export const queryDepositsTool = (ctx: AgentContext) =>
  tool(
    async ({ status, limit = 30 }) => {
      const deposits = await queryDepositsForAgent({
        organizationId: ctx.organizationId,
        status,
        limit,
      });

      return JSON.stringify(deposits);
    },
    {
      name: 'query_deposits',
      description:
        '查询押金列表，返回押金ID、租户、房间、金额、已收/已退/已扣、状态。',
      schema: z.object({
        status: z
          .enum([
            'UNPAID',
            'PAID',
            'PARTIAL_REFUNDED',
            'FULLY_REFUNDED',
            'DEDUCTED',
          ])
          .optional()
          .describe('按押金状态筛选'),
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

export const queryDepositSummaryTool = (ctx: AgentContext) =>
  tool(
    async () => {
      const summary = await queryDepositSummaryForAgent(ctx.organizationId);
      return JSON.stringify(summary);
    },
    {
      name: 'query_deposit_summary',
      description:
        '获取押金汇总统计，包括总金额、已收、已退、已扣、持有金额，以及按状态分布的数量。不需要参数。',
      schema: z.object({}),
    }
  );
