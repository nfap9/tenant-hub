import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { queryRoomDetailForAgent } from '../../services/forAgent/apartment.js';
import type { AgentContext } from '../types.js';

export const queryRoomDetailTool = (ctx: AgentContext) =>
  tool(
    async ({ roomId }) => {
      const detail = await queryRoomDetailForAgent({
        organizationId: ctx.organizationId,
        roomId,
      });

      if (!detail) {
        return JSON.stringify({ error: '房间不存在' });
      }

      return JSON.stringify(detail);
    },
    {
      name: 'query_room_detail',
      description:
        '查询单个房间的详细信息，包括公寓信息、预留记录、活跃租约（费用、押金）、当月账单、最近抄表读数。',
      schema: z.object({
        roomId: z.string().describe('房间ID'),
      }),
    }
  );
