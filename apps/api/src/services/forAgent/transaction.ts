import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';

const AGENT_TRANSACTION_CATEGORIES: Record<
  string,
  { label: string; type: string }
> = {
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

/**
 * Agent 查询收支记录列表
 * @param organizationId - 组织 ID
 * @param type - 收支类型筛选（可选）
 * @param category - 科目筛选（可选）
 * @param startDate - 开始日期筛选（可选）
 * @param endDate - 结束日期筛选（可选）
 * @param sourceType - 来源类型筛选（可选）
 * @param keyword - 关键词搜索（可选）
 * @param page - 页码，默认 1
 * @param pageSize - 每页条数，默认 20
 * @returns 格式化后的收支记录列表及分页信息
 */
export const queryTransactionsForAgent = async ({
  organizationId,
  type,
  category,
  startDate,
  endDate,
  sourceType,
  keyword,
  page = 1,
  pageSize = 20,
}: {
  organizationId: string;
  type?: 'INCOME' | 'EXPENSE';
  category?: string;
  startDate?: Date;
  endDate?: Date;
  sourceType?:
    | 'BILL_PAYMENT'
    | 'DEPOSIT_PAYMENT'
    | 'SETTLEMENT_PAYMENT'
    | 'APARTMENT_EXPENSE'
    | 'RESERVATION'
    | 'MANUAL';
  keyword?: string;
  page?: number;
  pageSize?: number;
}) => {
  const where: Prisma.TransactionWhereInput = {
    organizationId,
    deletedAt: null,
    ...(type && { type }),
    ...(category && { category }),
    ...(sourceType && { sourceType }),
    ...(keyword
      ? {
          OR: [
            { description: { contains: keyword, mode: 'insensitive' } },
            { note: { contains: keyword, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(startDate || endDate
      ? {
          occurredAt: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          },
        }
      : {}),
  };

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

  return {
    items: items.map((t) => ({
      id: t.id,
      type: t.type,
      category: t.category,
      categoryLabel:
        AGENT_TRANSACTION_CATEGORIES[t.category]?.label ?? t.category,
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
  };
};

/**
 * Agent 查询收支汇总统计
 * @param organizationId - 组织 ID
 * @param startDate - 统计开始日期（可选）
 * @param endDate - 统计结束日期（可选）
 * @returns 收支汇总数据，包含总收入、总支出、净收入、交易笔数及按科目的汇总
 */
export const queryTransactionSummaryForAgent = async ({
  organizationId,
  startDate,
  endDate,
}: {
  organizationId: string;
  startDate?: Date;
  endDate?: Date;
}) => {
  const where: Prisma.TransactionWhereInput = {
    organizationId,
    deletedAt: null,
    status: 'COMPLETED',
    ...(startDate || endDate
      ? {
          occurredAt: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          },
        }
      : {}),
  };

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
        label: AGENT_TRANSACTION_CATEGORIES[t.category]?.label ?? t.category,
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

  return {
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
  };
};
