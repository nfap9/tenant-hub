import assert from "node:assert/strict";
import {
  calculateBillingPeriods,
  calculateUtilityAmount,
  generateCurrentLeaseBills,
  getCurrentMonthBillWindow,
  getBillingDatesThrough,
  shouldGeneratePostpaidBill
} from "./billing.js";

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

const periods = calculateBillingPeriods({
  leaseStartDate: date("2026-05-05"),
  leaseEndDate: date("2026-12-04"),
  cycle: "MONTHLY",
  billingDate: date("2026-06-05")
});

assert.equal(periods.prepaid.start.toISOString(), date("2026-06-05").toISOString(), "prepaid rent starts on the billing date");
assert.equal(periods.prepaid.end.toISOString(), date("2026-07-04").toISOString(), "prepaid rent covers the next rent cycle");
assert.equal(periods.postpaid.start.toISOString(), date("2026-05-05").toISOString(), "postpaid utilities start at the previous rent cycle");
assert.equal(periods.postpaid.end.toISOString(), date("2026-06-04").toISOString(), "postpaid utilities end the day before the billing date");

assert.equal(
  shouldGeneratePostpaidBill({ leaseStartDate: date("2026-05-05"), billingDate: date("2026-05-05") }),
  false,
  "first billing date should not generate previous utilities"
);
assert.equal(
  shouldGeneratePostpaidBill({ leaseStartDate: date("2026-05-05"), billingDate: date("2026-06-05") }),
  true,
  "later billing dates should generate previous utilities"
);

assert.deepEqual(
  getBillingDatesThrough({
    leaseStartDate: date("2026-05-05"),
    leaseEndDate: date("2026-12-04"),
    cycle: "MONTHLY",
    today: date("2026-07-10")
  }).map((value) => value.toISOString()),
  [date("2026-05-05").toISOString(), date("2026-06-05").toISOString(), date("2026-07-05").toISOString()],
  "billing dates should include every rent day through today"
);

assert.equal(
  calculateUtilityAmount({
    previousWater: 10,
    currentWater: 18,
    waterUnitPrice: 4,
    previousPower: 100,
    currentPower: 160,
    powerUnitPrice: 0.8
  }).toString(),
  "80",
  "utility amount should combine water and power usage"
);

assert.throws(
  () =>
    calculateUtilityAmount({
      previousWater: 18,
      currentWater: 10,
      waterUnitPrice: 4,
      previousPower: 100,
      currentPower: 160,
      powerUnitPrice: 0.8
    }),
  /水表本期读数不能小于上期读数/,
  "water readings cannot go backwards"
);

const currentBillResult = await generateCurrentLeaseBills("org-a", date("2026-07-10"), {
  findCurrentLeases: async (organizationId) => {
    assert.equal(organizationId, "org-a", "current bill generation should query leases by organization");
    return [{ id: "lease-a" }, { id: "lease-b" }];
  },
  generateLeaseBillsForLease: async (leaseId, today) => {
    assert.equal(today.toISOString(), date("2026-07-10").toISOString(), "today should be passed through to every lease");
    return leaseId === "lease-a" ? ["bill-a-1", "bill-a-2"] : ["bill-b-1"];
  }
});

assert.deepEqual(
  currentBillResult,
  { leaseCount: 2, billIds: ["bill-a-1", "bill-a-2", "bill-b-1"] },
  "current bill generation should generate every current lease and flatten bill ids"
);

const emptyCurrentBillResult = await generateCurrentLeaseBills("org-empty", date("2026-07-10"), {
  findCurrentLeases: async () => [],
  generateLeaseBillsForLease: async () => {
    throw new Error("should not generate bills when there are no current leases");
  }
});

assert.deepEqual(emptyCurrentBillResult, { leaseCount: 0, billIds: [] }, "empty organizations should return an empty generation summary");

const currentMonthWindow = getCurrentMonthBillWindow(date("2026-07-10"));
assert.equal(currentMonthWindow.start.toISOString(), date("2026-07-01").toISOString(), "current month bill window should start on the first day");
assert.equal(currentMonthWindow.end.toISOString(), date("2026-08-01").toISOString(), "current month bill window should end at the next month start");

console.info("billing tests passed");
