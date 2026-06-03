import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import type { AgentContext } from '../types.js';

export const queryApartmentContractTool = (ctx: AgentContext) =>
  tool(
    async ({ apartmentId }) => {
      const apartment = await prisma.apartment.findFirst({
        where: { id: apartmentId, organizationId: ctx.organizationId },
        select: { id: true, name: true },
      });
      if (!apartment) {
        return JSON.stringify({ error: '公寓不存在' });
      }

      const contract = await prisma.apartmentContract.findUnique({
        where: { apartmentId },
      });

      if (!contract) {
        return JSON.stringify({
          apartmentId: apartment.id,
          apartmentName: apartment.name,
          contract: null,
        });
      }

      return JSON.stringify({
        apartmentId: apartment.id,
        apartmentName: apartment.name,
        contract: {
          landlordName: contract.landlordName,
          landlordPhone: contract.landlordPhone,
          contractStart: contract.contractStart
            ? contract.contractStart.toISOString().split('T')[0]
            : null,
          contractEnd: contract.contractEnd
            ? contract.contractEnd.toISOString().split('T')[0]
            : null,
          rentAmount: contract.rentAmount ? Number(contract.rentAmount) : null,
          floors: contract.floors,
          landArea: contract.landArea ? Number(contract.landArea) : null,
          totalArea: contract.totalArea ? Number(contract.totalArea) : null,
        },
      });
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
