import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { queryApartmentContractForAgent } from '../../services/forAgent/apartment.js';
import type { AgentContext } from '../types.js';

export const queryApartmentContractTool = (ctx: AgentContext) =>
  tool(
    async ({ apartmentId }) => {
      const result = await queryApartmentContractForAgent({
        organizationId: ctx.organizationId,
        apartmentId,
      });

      if (!result) {
        return JSON.stringify({ error: '公寓不存在' });
      }

      return JSON.stringify(result);
    },
    {
      name: 'query_apartment_contract',
      description:
        '查询公寓的上游租赁合同信息，包括房东信息、合同日期、租金、楼层和面积等。',
      schema: z.object({
        apartmentId: z.string().describe('公寓ID'),
      }),
    }
  );
