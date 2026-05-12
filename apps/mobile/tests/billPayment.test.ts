import { getPaymentAmountError } from '../src/screens/bills/billPayment';

describe('bill payment', () => {
  it('should validate payment amount', () => {
    expect(getPaymentAmountError('', 100)).toBe('请填写收款金额');
    expect(getPaymentAmountError('abc', 100)).toBe('收款金额必须是有效数字');
    expect(getPaymentAmountError('0', 100)).toBe('收款金额必须大于 0');
    expect(getPaymentAmountError('-1', 100)).toBe('收款金额必须大于 0');
    expect(getPaymentAmountError('101', 100)).toBe('收款金额不能超过剩余应收 ¥100.00');
    expect(getPaymentAmountError('100', 100)).toBeUndefined();
  });
});
