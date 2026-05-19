import { describe, it, expect } from "vitest";
import {
  calculateBillingPeriods,
  calculateUtilityAmount,
  calculateUtilityLineAmounts,
  generateCurrentLeaseBills,
  getCurrentMonthBillWindow,
  getBillMonthLabel,
  getBillingDatesThrough,
  shouldGeneratePostpaidBill
} from "../../src/services/billing.js";

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe("billing", () => {
  it("should calculate billing periods correctly", () => {
    const periods = calculateBillingPeriods({
      leaseStartDate: date("2026-05-05"),
      leaseEndDate: date("2026-12-04"),
      cycle: "MONTHLY",
      billingDate: date("2026-06-05")
    });

    expect(periods.prepaid.start.toISOString()).toBe(date("2026-06-05").toISOString());
    expect(periods.prepaid.end.toISOString()).toBe(date("2026-07-04").toISOString());
    expect(periods.postpaid.start.toISOString()).toBe(date("2026-05-05").toISOString());
    expect(periods.postpaid.end.toISOString()).toBe(date("2026-06-04").toISOString());
  });

  it("should not generate postpaid bill on first billing date", () => {
    expect(shouldGeneratePostpaidBill({ leaseStartDate: date("2026-05-05"), billingDate: date("2026-05-05") })).toBe(false);
  });

  it("should generate postpaid bill on later billing dates", () => {
    expect(shouldGeneratePostpaidBill({ leaseStartDate: date("2026-05-05"), billingDate: date("2026-06-05") })).toBe(true);
  });

  it("should include every rent day through today", () => {
    expect(
      getBillingDatesThrough({
        leaseStartDate: date("2026-05-05"),
        leaseEndDate: date("2026-12-04"),
        cycle: "MONTHLY",
        today: date("2026-07-10")
      }).map((value) => value.toISOString())
    ).toEqual([date("2026-05-05").toISOString(), date("2026-06-05").toISOString(), date("2026-07-05").toISOString()]);
  });

  it("should combine water and power usage for utility amount", () => {
    expect(
      calculateUtilityAmount({
        previousWater: 10,
        currentWater: 18,
        waterUnitPrice: 4,
        previousPower: 100,
        currentPower: 160,
        powerUnitPrice: 0.8
      }).toString()
    ).toBe("80");
  });

  it("should reject backwards water readings", () => {
    expect(() =>
      calculateUtilityAmount({
        previousWater: 18,
        currentWater: 10,
        waterUnitPrice: 4,
        previousPower: 100,
        currentPower: 160,
        powerUnitPrice: 0.8
      })
    ).toThrow(/水表本期读数不能小于上期读数/);
  });

  it("should generate bills for every current lease", async () => {
    const result = await generateCurrentLeaseBills("org-a", date("2026-07-10"), {
      findCurrentLeases: async (organizationId) => {
        expect(organizationId).toBe("org-a");
        return [{ id: "lease-a" }, { id: "lease-b" }] as unknown as Awaited<ReturnType<Parameters<typeof generateCurrentLeaseBills>[2]["findCurrentLeases"]>>;
      },
      generateLeaseBillsForLease: async (leaseId, today) => {
        expect(today.toISOString()).toBe(date("2026-07-10").toISOString());
        return leaseId === "lease-a" ? ["bill-a-1", "bill-a-2"] : ["bill-b-1"];
      }
    });

    expect(result).toEqual({ leaseCount: 2, billIds: ["bill-a-1", "bill-a-2", "bill-b-1"] });
  });

  it("should return empty for organizations with no current leases", async () => {
    const result = await generateCurrentLeaseBills("org-empty", date("2026-07-10"), {
      findCurrentLeases: async () => [],
      generateLeaseBillsForLease: async () => {
        throw new Error("should not generate bills when there are no current leases");
      }
    });

    expect(result).toEqual({ leaseCount: 0, billIds: [] });
  });

  it("should define current month bill window correctly", () => {
    const currentMonthWindow = getCurrentMonthBillWindow(date("2026-07-10"));
    expect(currentMonthWindow.start.toISOString()).toBe(date("2026-07-01").toISOString());
    expect(currentMonthWindow.end.toISOString()).toBe(date("2026-08-01").toISOString());
  });

  it("should format bill month label correctly", () => {
    expect(getBillMonthLabel(date("2026-07-01"))).toBe("2026年7月");
  });

  it("should calculate utility line amounts separately", () => {
    const result = calculateUtilityLineAmounts({
      previousWater: 10,
      currentWater: 18,
      waterUnitPrice: 4,
      previousPower: 100,
      currentPower: 160,
      powerUnitPrice: 0.8
    });

    expect(result.waterAmount.toString()).toBe("32");
    expect(result.powerAmount.toString()).toBe("48");
  });
});
