import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getAnalyticsSummaryForAgent } from '../../services/analytics.js';
import type { AgentContext } from '../types.js';

export const analyticsSummaryTool = (ctx: AgentContext) =>
  tool(
    async () => {
      const summary = await getAnalyticsSummaryForAgent(ctx.organizationId);
      return JSON.stringify(summary);
    },
    {
      name: 'analytics_summary',
      description:
        '获取当前组织的经营数据汇总，包括：公寓数、房间数、空置率、活跃租约数、本月租金收入、未收金额、总收缴率。不需要参数。',
      schema: z.object({}),
    }
  );
