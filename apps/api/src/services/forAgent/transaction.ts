import {
  listTransactionsRaw,
  getTransactionSummaryRaw,
} from '../transaction.js';
import { getCategoryLabel } from '../transactionCategories.js';
import { toAgentTransactionSummary } from './mappers/index.js';

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
  const result = await listTransactionsRaw({
    organizationId,
    type,
    category,
    startDate,
    endDate,
    sourceType,
    keyword,
    page,
    pageSize,
  });

  return {
    ...result,
    items: result.items.map(toAgentTransactionSummary),
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
  const transactions = await getTransactionSummaryRaw({
    organizationId,
    startDate,
    endDate,
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
        label: getCategoryLabel(t.category),
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
