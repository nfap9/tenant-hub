import assert from "node:assert/strict";
import { calculateSettlementAmounts, getSettlementDirection, validateMoveOutReadings } from "./leaseSettlement.js";

const base = {
  depositAmount: 3000,
  depositDeductionAmount: 500,
  rentAdjustmentAmount: -300,
  previousWater: 10,
  currentWater: 18,
  waterUnitPrice: 4,
  previousPower: 100,
  currentPower: 160,
  powerUnitPrice: 0.8,
  otherFeeAmount: 200
};

const result = calculateSettlementAmounts(base);

assert.equal(result.utilityAmount.toString(), "80", "utility amount should combine water and power");
assert.equal(result.depositRefundAmount.toString(), "2500", "deposit refund should subtract deduction");
assert.equal(result.receivableAmount.toString(), "780", "receivable should include deduction, utilities, and other fees");
assert.equal(result.refundableAmount.toString(), "2800", "refundable should include deposit refund and rent refund");
assert.equal(result.netAmount.toString(), "-2020", "net should be receivable minus refundable");
assert.equal(getSettlementDirection(result.netAmount), "REFUND", "negative net means refund");

const receivable = calculateSettlementAmounts({ ...base, rentAdjustmentAmount: 600, depositDeductionAmount: 3000 });
assert.equal(receivable.netAmount.toString(), "3880", "positive net should be tenant receivable");
assert.equal(getSettlementDirection(receivable.netAmount), "RECEIVE", "positive net means receive");

assert.equal(getSettlementDirection(0), "NONE", "zero net means settled");

assert.doesNotThrow(() => validateMoveOutReadings({ previousWater: 1, currentWater: 1, previousPower: 2, currentPower: 3 }));
assert.throws(
  () => validateMoveOutReadings({ previousWater: 2, currentWater: 1, previousPower: 2, currentPower: 3 }),
  /退租水表读数不能小于上次读数/
);
assert.throws(
  () => validateMoveOutReadings({ previousWater: 1, currentWater: 2, previousPower: 4, currentPower: 3 }),
  /退租电表读数不能小于上次读数/
);

console.info("lease settlement tests passed");
