import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { queryReservationForAgent } from '../../services/forAgent/reservation.js';
import type { AgentContext } from '../types.js';

export const queryReservationTool = (ctx: AgentContext) =>
  tool(
    async ({ roomId }) => {
      const reservation = await queryReservationForAgent({
        organizationId: ctx.organizationId,
        roomId,
      });

      return JSON.stringify(reservation);
    },
    {
      name: 'query_reservation',
      description: '查询房间的预留信息。返回预留客户、预期入住日期、定金等。',
      schema: z.object({
        roomId: z.string().describe('房间ID'),
      }),
    }
  );
