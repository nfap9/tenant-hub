import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { queryMeterReadingsForAgent } from '../../services/forAgent/bill.js';
import type { AgentContext } from '../types.js';

export const queryMeterReadingsTool = (ctx: AgentContext) =>
  tool(
    async ({ roomId, meterType, limit = 30 }) => {
      const readings = await queryMeterReadingsForAgent({
        organizationId: ctx.organizationId,
        roomId,
        meterType,
        limit,
      });

      return JSON.stringify(readings);
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
