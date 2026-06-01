import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { assertBillPaymentAllowed } from '../../src/services/billing.js';

describe('billing payments', () => {
  it('should allow paying the exact remaining amount', () => {
    expect(() => {
      assertBillPaymentAllowed({
        status: 'UNPAID',
        totalAmount: new Prisma.Decimal(100),
        paidAmount: new Prisma.Decimal(40),
        amount: 60,
      });
    }).not.toThrow();
  });

  it('should reject zero amount for bill payment', () => {
    expect(() =>
      assertBillPaymentAllowed({
        status: 'UNPAID',
        totalAmount: new Prisma.Decimal(100),
        paidAmount: new Prisma.Decimal(40),
        amount: 0,
      })
    ).toThrow(/收款金额必须大于 0/);
  });

  it('should reject overpayment for bill payment', () => {
    expect(() =>
      assertBillPaymentAllowed({
        status: 'PARTIAL_PAID',
        totalAmount: new Prisma.Decimal(100),
        paidAmount: new Prisma.Decimal(40),
        amount: 61,
      })
    ).toThrow(/收款金额不能超过剩余应收/);
  });

  it('should reject paid bills', () => {
    expect(() =>
      assertBillPaymentAllowed({
        status: 'PAID',
        totalAmount: new Prisma.Decimal(100),
        paidAmount: new Prisma.Decimal(100),
        amount: 1,
      })
    ).toThrow(/已结清或作废/);
  });

  it('should reject refunded bills', () => {
    expect(() =>
      assertBillPaymentAllowed({
        status: 'REFUNDED',
        totalAmount: new Prisma.Decimal(100),
        paidAmount: new Prisma.Decimal(0),
        amount: 1,
      })
    ).toThrow(/已结清或作废/);
  });
});
