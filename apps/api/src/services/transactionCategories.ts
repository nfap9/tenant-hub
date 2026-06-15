import { TransactionType } from '@prisma/client';

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

/**
 * 获取交易科目的中文标签
 * @param category - 交易科目代码
 * @returns 科目中文标签，若未找到则返回原代码
 */
export const getCategoryLabel = (category: string) =>
  TRANSACTION_CATEGORIES[category as TransactionCategory]?.label || category;

/**
 * 获取交易科目的收支类型
 * @param category - 交易科目代码
 * @returns 收支类型（INCOME 或 EXPENSE），若未找到则默认为 INCOME
 */
export const getCategoryType = (category: string) =>
  TRANSACTION_CATEGORIES[category as TransactionCategory]?.type || 'INCOME';

/**
 * 根据账单明细类型推断交易科目
 * @param type - 账单明细类型
 * @returns 对应的交易科目代码
 */
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
