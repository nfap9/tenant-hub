import { Prisma, TransactionType, TransactionSourceType } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export const TRANSACTION_CATEGORIES = {
  // 收入科目
  RENT: { label: '房租收入', type: 'INCOME' as TransactionType },
  DEPOSIT_COLLECT: { label: '押金收入', type: 'INCOME' as TransactionType },
  UTILITY: { label: '水电费收入', type: 'INCOME' as TransactionType },
  MANAGEMENT_FEE: { label: '管理费收入', type: 'INCOME' as TransactionType },
  PENALTY: { label: '违约金', type: 'INCOME' as TransactionType },
  COMPENSATION: { label: '赔偿金收入', type: 'INCOME' as TransactionType },
  RESERVATION_FEE: { label: '定金收入', type: 'INCOME' as TransactionType },
  OTHER_INCOME: { label: '其他收入', type: 'INCOME' as TransactionType },

  // 支出科目
  DEPOSIT_REFUND: { label: '押金退还', type: 'EXPENSE' as TransactionType },
  BILL_REFUND: { label: '账单退款', type: 'EXPENSE' as TransactionType },
  UTILITY_COST: { label: '水电成本', type: 'EXPENSE' as TransactionType },
  MAINTENANCE: { label: '维修支出', type: 'EXPENSE' as TransactionType },
  COMPENSATION_PAY: { label: '赔偿金支出', type: 'EXPENSE' as TransactionType },
  OTHER_EXPENSE: { label: '其他支出', type: 'EXPENSE' as TransactionType },
} as const;

export type TransactionCategory = keyof typeof TRANSACTION_CATEGORIES;

export const getCategoryLabel = (category: string) =>
  TRANSACTION_CATEGORIES[category as TransactionCategory]?.label || category;

export const getCategoryType = (category: string) =>
  TRANSACTION_CATEGORIES[category as TransactionCategory]?.type || 'INCOME';

// 根据账单明细类型推断科目
export const getCategoryFromBillItemType = (
  type: string
): TransactionCategory => {
  const mapping: Record<string, TransactionCategory> = {
    RENT: 'RENT',
    UTILITY: 'UTILITY',
    WATER: 'UTILITY',
    POWER: 'UTILITY',
    DEPOSIT: 'DEPOSIT_COLLECT',
    MANAGEMENT: 'MANAGEMENT_FEE',
    SANITATION: 'MANAGEMENT_FEE',
    ELEVATOR: 'MANAGEMENT_FEE',
    PROPERTY: 'MANAGEMENT_FEE',
    NETWORK: 'MANAGEMENT_FEE',
    PENALTY: 'PENALTY',
    COMPENSATION: 'COMPENSATION',
    OTHER: 'OTHER_INCOME',
  };
  return mapping[type] || 'OTHER_INCOME';
};

type CreateTransactionInput = {
  organizationId: string;
  type: TransactionType;
  category: string;
  amount: Prisma.Decimal.Value;
  method: string;
  description?: string;
  note?: string;
  operatorId: string;
  occurredAt?: Date;
  sourceType: TransactionSourceType;
  sourceId: string;
  billId?: string;
  depositId?: string;
  leaseId?: string;
  apartmentId?: string;
};

export const createTransaction = async (input: CreateTransactionInput) => {
  return prisma.transaction.create({
    data: {
      organizationId: input.organizationId,
      type: input.type,
      category: input.category,
      amount: input.amount,
      method: input.method,
      description: input.description,
      note: input.note,
      operatorId: input.operatorId,
      occurredAt: input.occurredAt,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      billId: input.billId,
      depositId: input.depositId,
      leaseId: input.leaseId,
      apartmentId: input.apartmentId,
    },
  });
};

type ListTransactionsInput = {
  organizationId: string;
  type?: TransactionType;
  category?: string;
  startDate?: Date;
  endDate?: Date;
  method?: string;
  apartmentId?: string;
  leaseId?: string;
  sourceType?: TransactionSourceType;
  keyword?: string;
  page?: number;
  pageSize?: number;
};

export const listTransactions = async (input: ListTransactionsInput) => {
  const {
    organizationId,
    type,
    category,
    startDate,
    endDate,
    method,
    apartmentId,
    leaseId,
    sourceType,
    keyword,
    page = 1,
    pageSize = 20,
  } = input;

  const where: Prisma.TransactionWhereInput = {
    organizationId,
    deletedAt: null,
    ...(type && { type }),
    ...(category && { category }),
    ...(method && { method }),
    ...(apartmentId && { apartmentId }),
    ...(leaseId && { leaseId }),
    ...(sourceType && { sourceType }),
    ...(startDate || endDate
      ? {
          occurredAt: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          },
        }
      : {}),
    ...(keyword
      ? {
          OR: [
            { description: { contains: keyword, mode: 'insensitive' } },
            { note: { contains: keyword, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        operator: { select: { id: true, username: true } },
        bill: {
          select: {
            id: true,
            mode: true,
            periodStart: true,
            periodEnd: true,
          },
        },
        lease: {
          select: {
            id: true,
            tenantName: true,
            room: {
              select: { roomNo: true, apartment: { select: { name: true } } },
            },
          },
        },
        apartment: { select: { id: true, name: true } },
      },
      orderBy: { occurredAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.transaction.count({ where }),
  ]);

  return { items, total, page, pageSize };
};

export const getTransactionSummary = async ({
  organizationId,
  startDate,
  endDate,
}: {
  organizationId: string;
  startDate?: Date;
  endDate?: Date;
}) => {
  const dateFilter: Prisma.DateTimeFilter | undefined =
    startDate || endDate
      ? {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate }),
        }
      : undefined;

  const where: Prisma.TransactionWhereInput = {
    organizationId,
    deletedAt: null,
    status: 'COMPLETED',
    ...(dateFilter && { occurredAt: dateFilter }),
  };

  const transactions = await prisma.transaction.findMany({
    where,
    select: {
      type: true,
      category: true,
      amount: true,
      method: true,
      occurredAt: true,
    },
  });

  const totalIncome = transactions
    .filter((t) => t.type === 'INCOME')
    .reduce((sum, t) => sum.plus(t.amount), new Prisma.Decimal(0));

  const totalExpense = transactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((sum, t) => sum.plus(t.amount), new Prisma.Decimal(0));

  // 按科目汇总
  const byCategoryMap = new Map<
    string,
    {
      category: string;
      label: string;
      income: Prisma.Decimal;
      expense: Prisma.Decimal;
    }
  >();

  for (const t of transactions) {
    const existing = byCategoryMap.get(t.category);
    if (existing) {
      if (t.type === 'INCOME') {
        existing.income = existing.income.plus(t.amount);
      } else {
        existing.expense = existing.expense.plus(t.amount);
      }
    } else {
      byCategoryMap.set(t.category, {
        category: t.category,
        label: getCategoryLabel(t.category),
        income:
          t.type === 'INCOME'
            ? new Prisma.Decimal(t.amount)
            : new Prisma.Decimal(0),
        expense:
          t.type === 'EXPENSE'
            ? new Prisma.Decimal(t.amount)
            : new Prisma.Decimal(0),
      });
    }
  }

  // 按支付方式汇总
  const byMethodMap = new Map<
    string,
    { method: string; income: Prisma.Decimal; expense: Prisma.Decimal }
  >();

  for (const t of transactions) {
    const existing = byMethodMap.get(t.method);
    if (existing) {
      if (t.type === 'INCOME') {
        existing.income = existing.income.plus(t.amount);
      } else {
        existing.expense = existing.expense.plus(t.amount);
      }
    } else {
      byMethodMap.set(t.method, {
        method: t.method,
        income:
          t.type === 'INCOME'
            ? new Prisma.Decimal(t.amount)
            : new Prisma.Decimal(0),
        expense:
          t.type === 'EXPENSE'
            ? new Prisma.Decimal(t.amount)
            : new Prisma.Decimal(0),
      });
    }
  }

  // 按日期汇总（最近30天）
  const byDateMap = new Map<
    string,
    { date: string; income: Prisma.Decimal; expense: Prisma.Decimal }
  >();

  for (const t of transactions) {
    const date = t.occurredAt.toISOString().split('T')[0];
    const existing = byDateMap.get(date);
    if (existing) {
      if (t.type === 'INCOME') {
        existing.income = existing.income.plus(t.amount);
      } else {
        existing.expense = existing.expense.plus(t.amount);
      }
    } else {
      byDateMap.set(date, {
        date,
        income:
          t.type === 'INCOME'
            ? new Prisma.Decimal(t.amount)
            : new Prisma.Decimal(0),
        expense:
          t.type === 'EXPENSE'
            ? new Prisma.Decimal(t.amount)
            : new Prisma.Decimal(0),
      });
    }
  }

  return {
    totalIncome,
    totalExpense,
    netAmount: totalIncome.minus(totalExpense),
    byCategory: Array.from(byCategoryMap.values()).map((c) => ({
      ...c,
      income: c.income.toFixed(2),
      expense: c.expense.toFixed(2),
    })),
    byMethod: Array.from(byMethodMap.values()).map((m) => ({
      ...m,
      income: m.income.toFixed(2),
      expense: m.expense.toFixed(2),
    })),
    byDate: Array.from(byDateMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        ...d,
        income: d.income.toFixed(2),
        expense: d.expense.toFixed(2),
      })),
  };
};

export const getTransactionById = async (
  id: string,
  organizationId: string
) => {
  return prisma.transaction.findFirst({
    where: { id, organizationId, deletedAt: null },
    include: {
      operator: { select: { id: true, username: true } },
      bill: {
        select: {
          id: true,
          mode: true,
          periodStart: true,
          periodEnd: true,
          status: true,
        },
      },
      lease: {
        select: {
          id: true,
          tenantName: true,
          room: {
            select: { roomNo: true, apartment: { select: { name: true } } },
          },
        },
      },
      apartment: { select: { id: true, name: true } },
    },
  });
};

export const deleteTransaction = async (id: string, organizationId: string) => {
  const transaction = await prisma.transaction.findFirst({
    where: { id, organizationId, deletedAt: null },
  });
  if (!transaction) return null;

  // 只允许删除手动创建的收支记录
  if (transaction.sourceType !== 'MANUAL') {
    throw new Error('只能删除手动创建的收支记录');
  }

  return prisma.transaction.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
};
