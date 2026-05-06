import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { assertBillPaymentAllowed, assertMonthlyBillPaymentAllowed } from "./billing.js";

assert.doesNotThrow(() => {
  assertBillPaymentAllowed({
    status: "UNPAID",
    totalAmount: new Prisma.Decimal(100),
    paidAmount: new Prisma.Decimal(40),
    amount: 60
  });
}, "bill payment should allow paying the exact remaining amount");

assert.throws(
  () =>
    assertBillPaymentAllowed({
      status: "UNPAID",
      totalAmount: new Prisma.Decimal(100),
      paidAmount: new Prisma.Decimal(40),
      amount: 0
    }),
  /收款金额必须大于 0/,
  "bill payment should reject zero amount"
);

assert.throws(
  () =>
    assertBillPaymentAllowed({
      status: "PARTIAL_PAID",
      totalAmount: new Prisma.Decimal(100),
      paidAmount: new Prisma.Decimal(40),
      amount: 61
    }),
  /收款金额不能超过剩余应收/,
  "bill payment should reject overpayment"
);

assert.throws(
  () =>
    assertBillPaymentAllowed({
      status: "PAID",
      totalAmount: new Prisma.Decimal(100),
      paidAmount: new Prisma.Decimal(100),
      amount: 1
    }),
  /已结清或作废/,
  "bill payment should reject paid bills"
);

assert.doesNotThrow(() => {
  assertMonthlyBillPaymentAllowed({
    status: "UNPAID",
    totalAmount: new Prisma.Decimal(200),
    paidAmount: new Prisma.Decimal(100),
    childBillPaymentsCount: 0,
    amount: 100
  });
}, "monthly payment should allow the exact remaining amount when no child bills were paid directly");

assert.throws(
  () =>
    assertMonthlyBillPaymentAllowed({
      status: "UNPAID",
      totalAmount: new Prisma.Decimal(200),
      paidAmount: new Prisma.Decimal(0),
      childBillPaymentsCount: 1,
      amount: 100
    }),
  /子账单已有独立收款/,
  "monthly payment should reject mixed direct bill payments"
);

console.info("billing payment tests passed");
