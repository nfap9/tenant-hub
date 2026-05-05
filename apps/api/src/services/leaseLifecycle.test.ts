import assert from "node:assert/strict";
import { assertExpiredTerminationAllowed, getLeaseBillGenerationEnd, isAutoRenewalPeriod } from "./leaseLifecycle.js";

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

assert.equal(
  isAutoRenewalPeriod({ autoRenew: true, status: "ACTIVE", endDate: date("2026-05-01") }, date("2026-05-02")),
  true,
  "active auto-renew lease after end date should be in renewal period"
);

assert.equal(
  isAutoRenewalPeriod({ autoRenew: true, status: "ACTIVE", endDate: date("2026-05-01") }, date("2026-05-01")),
  false,
  "lease is not in renewal period on the original end date"
);

assert.equal(
  isAutoRenewalPeriod({ autoRenew: false, status: "ACTIVE", endDate: date("2026-05-01") }, date("2026-05-02")),
  false,
  "non-auto-renew lease should not enter renewal period"
);

assert.equal(
  getLeaseBillGenerationEnd(
    { autoRenew: false, status: "ACTIVE", startDate: date("2026-01-01"), endDate: date("2026-05-10"), cycle: "MONTHLY", terminatedAt: null },
    date("2026-08-01")
  ).toISOString(),
  date("2026-05-10").toISOString(),
  "non-auto-renew lease should stop at original end date"
);

assert.equal(
  getLeaseBillGenerationEnd(
    { autoRenew: true, status: "ACTIVE", startDate: date("2026-01-01"), endDate: date("2026-05-10"), cycle: "MONTHLY", terminatedAt: null },
    date("2026-07-15")
  ).toISOString(),
  date("2026-08-31").toISOString(),
  "active monthly auto-renew lease should generate through the next full cycle"
);

assert.equal(
  getLeaseBillGenerationEnd(
    { autoRenew: true, status: "TERMINATED", startDate: date("2026-01-01"), endDate: date("2026-05-10"), cycle: "QUARTERLY", terminatedAt: date("2026-06-20") },
    date("2026-07-15")
  ).toISOString(),
  date("2026-06-20").toISOString(),
  "terminated auto-renew lease should stop at termination date"
);

assert.doesNotThrow(() => assertExpiredTerminationAllowed(date("2026-05-10"), date("2026-05-10")));
assert.doesNotThrow(() => assertExpiredTerminationAllowed(date("2026-05-10"), date("2026-06-01")));
assert.throws(
  () => assertExpiredTerminationAllowed(date("2026-05-10"), date("2026-05-09")),
  /到期解约的退租日期不能早于原租约结束日期/,
  "expired termination before original end should be rejected"
);

console.info("leaseLifecycle tests passed");
