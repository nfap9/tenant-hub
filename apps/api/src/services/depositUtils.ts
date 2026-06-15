import type { Deposit } from '@prisma/client';

export interface DepositSummaryNumbers {
  totalAmount: number;
  paidAmount: number;
  refundedAmount: number;
  deductedAmount: number;
  heldAmount: number;
  count: number;
}

/**
 * 根据押金记录列表计算汇总金额（统一返回 number，便于复用）
 * @param deposits - 押金记录数组
 * @returns 汇总金额与数量
 */
export function calculateDepositSummary(
  deposits: Pick<
    Deposit,
    'amount' | 'paidAmount' | 'refundedAmount' | 'deductedAmount'
  >[]
): DepositSummaryNumbers {
  let totalAmount = 0;
  let paidAmount = 0;
  let refundedAmount = 0;
  let deductedAmount = 0;

  for (const d of deposits) {
    totalAmount += Number(d.amount);
    paidAmount += Number(d.paidAmount);
    refundedAmount += Number(d.refundedAmount);
    deductedAmount += Number(d.deductedAmount);
  }

  const heldAmount = paidAmount - refundedAmount - deductedAmount;

  return {
    totalAmount,
    paidAmount,
    refundedAmount,
    deductedAmount,
    heldAmount,
    count: deposits.length,
  };
}
