const money = (value: number) => value.toFixed(2);

export const getPaymentAmountError = (amountText: string, remainingAmount: number) => {
  if (!amountText.trim()) return '请填写收款金额';
  const amount = Number(amountText);
  if (!Number.isFinite(amount)) return '收款金额必须是有效数字';
  if (amount <= 0) return '收款金额必须大于 0';
  if (amount > remainingAmount) return `收款金额不能超过剩余应收 ¥${money(remainingAmount)}`;
  return undefined;
};
