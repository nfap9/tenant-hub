import assert from "node:assert/strict";
import {
  calculateBillingPeriods,
  calculateUtilityAmount,
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

console.info("billing tests passed");
