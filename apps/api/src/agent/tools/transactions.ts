import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  queryTransactionsForAgent,
  queryTransactionSummaryForAgent,
} from '../../services/forAgent/transaction.js';
import type { AgentContext } from '../types.js';

export const queryTransactionsTool = (ctx: AgentContext) =>
  tool(
    async ({
      type,
      category,
      startDate,
      endDate,
      sourceType,
      keyword,
      page = 1,
      pageSize = 20,
    }) => {
      const result = await queryTransactionsForAgent({
        organizationId: ctx.organizationId,
        type,
        category,
        startDate,
        endDate,
        sourceType,
        keyword,
        page,
        pageSize,
      });

      return JSON.stringify(result);
    },
    {
      name: 'query_transactions',
      description:
        '查询收支交易记录，支持按类型、科目、日期范围、来源类型、关键词筛选，返回分页结果。',
      schema: z.object({
        type: z
          .enum(['INCOME', 'EXPENSE'])
          .optional()
          .describe('收支类型：INCOME收入/EXPENSE支出'),
        category: z
          .string()
          .optional()
          .describe('科目代码，如RENT/DEPOSIT_COLLECT等'),
        startDate: z.coerce.date().optional().describe('开始日期'),
        endDate: z.coerce.date().optional().describe('结束日期'),
        sourceType: z
          .enum([
            'BILL_PAYMENT',
            'DEPOSIT_PAYMENT',
            'SETTLEMENT_PAYMENT',
            'APARTMENT_EXPENSE',
            'RESERVATION',
            'MANUAL',
          ])
          .optional()
          .describe('来源类型'),
        keyword: z.string().optional().describe('描述或备注关键词搜索'),
        page: z.number().int().min(1).optional().describe('页码，默认1'),
        pageSize: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe('每页条数，默认20'),
      }),
    }
  );

export const queryTransactionSummaryTool = (ctx: AgentContext) =>
  tool(
    async ({ startDate, endDate }) => {
      const summary = await queryTransactionSummaryForAgent({
        organizationId: ctx.organizationId,
        startDate,
        endDate,
      });

      return JSON.stringify(summary);
    },
    {
      name: 'query_transaction_summary',
      description:
        '获取收支汇总统计，包括总收入、总支出、净收入，以及按科目分类的明细。可按日期范围筛选。',
      schema: z.object({
        startDate: z.coerce.date().optional().describe('开始日期（可选）'),
        endDate: z.coerce.date().optional().describe('结束日期（可选）'),
      }),
    }
  );
