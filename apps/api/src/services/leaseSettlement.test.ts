import { describe, it, expect } from "vitest";
import { calculateSettlementAmounts, getSettlementDirection, validateMoveOutReadings } from "./leaseSettlement.js";

describe("lease settlement", () => {
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

  it("should calculate settlement amounts correctly", () => {
    const result = calculateSettlementAmounts(base);
    expect(result.utilityAmount.toString()).toBe("80");
    expect(result.depositRefundAmount.toString()).toBe("2500");
    expect(result.receivableAmount.toString()).toBe("780");
    expect(result.refundableAmount.toString()).toBe("2800");
    expect(result.netAmount.toString()).toBe("-2020");
  });

  it("should determine refund direction for negative net", () => {
    expect(getSettlementDirection(calculateSettlementAmounts(base).netAmount)).toBe("REFUND");
  });

  it("should determine receive direction for positive net", () => {
    const receivable = calculateSettlementAmounts({ ...base, rentAdjustmentAmount: 600, depositDeductionAmount: 3000 });
    expect(receivable.netAmount.toString()).toBe("3880");
    expect(getSettlementDirection(receivable.netAmount)).toBe("RECEIVE");
  });

  it("should determine none direction for zero net", () => {
    expect(getSettlementDirection(0)).toBe("NONE");
  });

  it("should allow valid move-out readings", () => {
    expect(() => validateMoveOutReadings({ previousWater: 1, currentWater: 1, previousPower: 2, currentPower: 3 })).not.toThrow();
  });

  it("should reject backwards water readings on move-out", () => {
    expect(() => validateMoveOutReadings({ previousWater: 2, currentWater: 1, previousPower: 2, currentPower: 3 })).toThrow(/退租水表读数不能小于上次读数/);
  });

  it("should reject backwards power readings on move-out", () => {
    expect(() => validateMoveOutReadings({ previousWater: 1, currentWater: 2, previousPower: 4, currentPower: 3 })).toThrow(/退租电表读数不能小于上次读数/);
  });
});
