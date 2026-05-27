import { describe, it, expect } from 'vitest';
import {
  calculateSettlementAmounts,
  getSettlementDirection,
  validateMoveOutReadings,
} from '../../src/services/leaseSettlement.js';

describe('lease settlement', () => {
  const base = {
    depositPaidAmount: 3000,
    rentAdjustmentAmount: -300,
    previousWater: 10,
    currentWater: 18,
    waterUnitPrice: 4,
    previousPower: 100,
    currentPower: 160,
    powerUnitPrice: 0.8,
    otherFeeAmount: 200,
  };

  it('should calculate settlement amounts correctly', () => {
    const result = calculateSettlementAmounts(base);
    expect(result.utilityAmount.toString()).toBe('80');
    expect(result.depositRefundAmount.toString()).toBe('3000');
    expect(result.receivableAmount.toString()).toBe('280');
    expect(result.refundableAmount.toString()).toBe('3300');
    expect(result.netAmount.toString()).toBe('-3020');
  });

  it('should determine refund direction for negative net', () => {
    expect(
      getSettlementDirection(calculateSettlementAmounts(base).netAmount)
    ).toBe('REFUND');
  });

  it('should determine receive direction for positive net', () => {
    const receivable = calculateSettlementAmounts({
      ...base,
      depositPaidAmount: 0,
      rentAdjustmentAmount: 600,
    });
    expect(receivable.netAmount.toString()).toBe('880');
    expect(getSettlementDirection(receivable.netAmount)).toBe('RECEIVE');
  });

  it('should determine none direction for zero net', () => {
    expect(getSettlementDirection(0)).toBe('NONE');
  });

  it('should include penalty and compensation in receivable', () => {
    const result = calculateSettlementAmounts({
      ...base,
      penaltyAmount: 300,
      compensationAmount: 200,
    });
    expect(result.receivableAmount.toString()).toBe('780');
    expect(result.netAmount.toString()).toBe('-2520');
  });

  it('should default penalty and compensation to zero when omitted', () => {
    const result = calculateSettlementAmounts({
      depositPaidAmount: 1000,
      rentAdjustmentAmount: 0,
      previousWater: 10,
      currentWater: 10,
      waterUnitPrice: 4,
      previousPower: 100,
      currentPower: 100,
      powerUnitPrice: 0.8,
      otherFeeAmount: 0,
    });
    expect(result.receivableAmount.toString()).toBe('0');
    expect(result.refundableAmount.toString()).toBe('1000');
    expect(result.netAmount.toString()).toBe('-1000');
  });

  it('should allow valid move-out readings', () => {
    expect(() =>
      validateMoveOutReadings({
        previousWater: 1,
        currentWater: 1,
        previousPower: 2,
        currentPower: 3,
      })
    ).not.toThrow();
  });

  it('should reject backwards water readings on move-out', () => {
    expect(() =>
      validateMoveOutReadings({
        previousWater: 2,
        currentWater: 1,
        previousPower: 2,
        currentPower: 3,
      })
    ).toThrow(/退租水表读数不能小于上次读数/);
  });

  it('should reject backwards power readings on move-out', () => {
    expect(() =>
      validateMoveOutReadings({
        previousWater: 1,
        currentWater: 2,
        previousPower: 4,
        currentPower: 3,
      })
    ).toThrow(/退租电表读数不能小于上次读数/);
  });
});
