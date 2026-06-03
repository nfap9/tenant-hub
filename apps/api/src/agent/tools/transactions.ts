import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';

const TRANSACTION_CATEGORIES: Record<string, { label: string; type: string }> =
  {
    RENT: { label: '房租收入', type: 'INCOME' },
    DEPOSIT_COLLECT: { label: '押金收入', type: 'INCOME' },
    UTILITY: { label: '水电费收入', type: 'INCOME' },
    MANAGEMENT_FEE: { label: '管理费收入', type: 'INCOME' },
    PENALTY: { label: '违约金', type: 'INCOME' },
    COMPENSATION: { label: '赔偿金收入', type: 'INCOME' },
    RESERVATION_FEE: { label: '定金收入', type: 'INCOME' },
    OTHER_INCOME: { label: '其他收入', type: 'INCOME' },
    DEPOSIT_REFUND: { label: '押金退还', type: 'EXPENSE' },
    BILL_REFUND: { label: '账单退款', type: 'EXPENSE' },
    UTILITY_COST: { label: '水电成本', type: 'EXPENSE' },
    MAINTENANCE: { label: '维修支出', type: 'EXPENSE' },
    COMPENSATION_PAY: { label: '赔偿金支出', type: 'EXPENSE' },
    OTHER_EXPENSE: { label: '其他支出', type: 'EXPENSE' },
  };

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
      const where: Record<string, unknown> = {
        organizationId: ctx.organizationId,
        deletedAt: null,
      };
      if (type) where.type = type;
      if (category) where.category = category;
      if (sourceType) where.sourceType = sourceType;
      if (keyword) {
        where.OR = [
          { description: { contains: keyword, mode: 'insensitive' } },
          { note: { contains: keyword, mode: 'insensitive' } },
        ];
      }
      if (startDate || endDate) {
        where.occurredAt = {
          ...(startDate ? { gte: startDate } : {}),
          ...(endDate ? { lte: endDate } : {}),
        };
      }

      const [items, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          include: {
            operator: { select: { username: true } },
            apartment: { select: { name: true } },
            lease: {
              select: {
                tenantName: true,
                room: {
                  select: {
                    roomNo: true,
                    apartment: { select: { name: true } },
                  },
                },
              },
            },
          },
          orderBy: { occurredAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.transaction.count({ where }),
      ]);

      return JSON.stringify({
        items: items.map((t) => ({
          id: t.id,
          type: t.type,
          category: t.category,
          categoryLabel:
            TRANSACTION_CATEGORIES[t.category]?.label ?? t.category,
          amount: Number(t.amount),
          method: t.method,
          description: t.description,
          sourceType: t.sourceType,
          occurredAt: t.occurredAt.toISOString().split('T')[0],
          note: t.note,
          apartmentName: t.apartment?.name ?? null,
          tenantName: t.lease?.tenantName ?? null,
          roomNo: t.lease?.room?.roomNo ?? null,
          operatorName: t.operator?.username ?? null,
        })),
        total,
        page,
        pageSize,
      });
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
      const where: Record<string, unknown> = {
        organizationId: ctx.organizationId,
        deletedAt: null,
        status: 'COMPLETED',
      };
      if (startDate || endDate) {
        where.occurredAt = {
          ...(startDate ? { gte: startDate } : {}),
          ...(endDate ? { lte: endDate } : {}),
        };
      }

      const transactions = await prisma.transaction.findMany({
        where,
        select: {
          type: true,
          category: true,
          amount: true,
        },
      });

      let totalIncome = 0;
      let totalExpense = 0;
      const byCategory: Record<
        string,
        { label: string; income: number; expense: number }
      > = {};

      for (const t of transactions) {
        const amount = Number(t.amount);
        if (t.type === 'INCOME') {
          totalIncome += amount;
        } else {
          totalExpense += amount;
        }

        if (!byCategory[t.category]) {
          byCategory[t.category] = {
            label: TRANSACTION_CATEGORIES[t.category]?.label ?? t.category,
            income: 0,
            expense: 0,
          };
        }
        if (t.type === 'INCOME') {
          byCategory[t.category].income += amount;
        } else {
          byCategory[t.category].expense += amount;
        }
      }

      return JSON.stringify({
        totalIncome: Number(totalIncome.toFixed(2)),
        totalExpense: Number(totalExpense.toFixed(2)),
        netIncome: Number((totalIncome - totalExpense).toFixed(2)),
        transactionCount: transactions.length,
        byCategory: Object.entries(byCategory).map(([key, val]) => ({
          category: key,
          label: val.label,
          income: Number(val.income.toFixed(2)),
          expense: Number(val.expense.toFixed(2)),
        })),
      });
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
