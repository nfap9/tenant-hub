import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { queryBillsForAgent } from '../../services/bill.js';
import type { AgentContext } from '../types.js';

export const queryBillsTool = (ctx: AgentContext) =>
  tool(
    async ({ status, tenantName, mode, limit = 30 }) => {
      const bills = await queryBillsForAgent({
        organizationId: ctx.organizationId,
        status,
        tenantName,
        mode,
        limit,
      });

      return JSON.stringify(bills);
    },
    {
      name: 'query_bills',
      description:
        '查询账单列表。返回账单ID、租户姓名、房间号、账单日期、账期、总金额、已付金额、状态、类型。',
      schema: z.object({
        status: z
          .enum([
            'DRAFT',
            'BILLING',
            'UNPAID',
            'PARTIAL_PAID',
            'PAID',
            'REFUNDED',
            'FAILED',
            'VOID',
          ])
          .optional()
          .describe('按账单状态筛选'),
        tenantName: z
          .string()
          .optional()
          .describe('按租户姓名关键词筛选（可选）'),
        mode: z
          .enum(['PREPAID', 'POSTPAID', 'DEPOSIT'])
          .optional()
          .describe('按账单类型筛选：PREPAID预付/POSTPAID后付/DEPOSIT押金'),
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
