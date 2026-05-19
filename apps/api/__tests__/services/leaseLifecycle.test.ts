import { describe, it, expect } from "vitest";
import { assertExpiredTerminationAllowed, getLeaseBillGenerationEnd, isAutoRenewalPeriod } from "./leaseLifecycle.js";

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe("lease lifecycle", () => {
  it("should detect renewal period for active auto-renew lease after end date", () => {
    expect(isAutoRenewalPeriod({ autoRenew: true, status: "ACTIVE", endDate: date("2026-05-01") }, date("2026-05-02"))).toBe(true);
  });

  it("should not detect renewal period on the original end date", () => {
    expect(isAutoRenewalPeriod({ autoRenew: true, status: "ACTIVE", endDate: date("2026-05-01") }, date("2026-05-01"))).toBe(false);
  });

  it("should not detect renewal period for non-auto-renew lease", () => {
    expect(isAutoRenewalPeriod({ autoRenew: false, status: "ACTIVE", endDate: date("2026-05-01") }, date("2026-05-02"))).toBe(false);
  });

  it("should stop at original end date for non-auto-renew lease", () => {
    expect(
      getLeaseBillGenerationEnd(
        { autoRenew: false, status: "ACTIVE", startDate: date("2026-01-01"), endDate: date("2026-05-10"), cycle: "MONTHLY", terminatedAt: null },
        date("2026-08-01")
      ).toISOString()
    ).toBe(date("2026-05-10").toISOString());
  });

  it("should generate through the next full cycle for active monthly auto-renew lease", () => {
    expect(
      getLeaseBillGenerationEnd(
        { autoRenew: true, status: "ACTIVE", startDate: date("2026-01-01"), endDate: date("2026-05-10"), cycle: "MONTHLY", terminatedAt: null },
        date("2026-07-15")
      ).toISOString()
    ).toBe(date("2026-08-31").toISOString());
  });

  it("should stop at termination date for terminated auto-renew lease", () => {
    expect(
      getLeaseBillGenerationEnd(
        { autoRenew: true, status: "TERMINATED", startDate: date("2026-01-01"), endDate: date("2026-05-10"), cycle: "QUARTERLY", terminatedAt: date("2026-06-20") },
        date("2026-07-15")
      ).toISOString()
    ).toBe(date("2026-06-20").toISOString());
  });

  it("should allow expired termination on or after original end date", () => {
    expect(() => assertExpiredTerminationAllowed(date("2026-05-10"), date("2026-05-10"))).not.toThrow();
    expect(() => assertExpiredTerminationAllowed(date("2026-05-10"), date("2026-06-01"))).not.toThrow();
  });

  it("should reject expired termination before original end date", () => {
    expect(() => assertExpiredTerminationAllowed(date("2026-05-10"), date("2026-05-09"))).toThrow(/到期解约的退租日期不能早于原租约结束日期/);
  });
});
