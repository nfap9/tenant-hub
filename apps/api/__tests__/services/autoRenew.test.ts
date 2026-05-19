import { describe, it, expect, vi, beforeEach } from "vitest";
import { processAutoRenewLeases } from "./autoRenew.js";

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

vi.mock("../config/prisma.js", () => ({
  prisma: {
    lease: {
      findMany: vi.fn(),
      update: vi.fn()
    }
  }
}));

vi.mock("./billing.js", () => ({
  generateLeaseBills: vi.fn()
}));

import { prisma } from "../config/prisma.js";
import { generateLeaseBills } from "./billing.js";

describe("autoRenew", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should extend endDate by one month for MONTHLY cycle", async () => {
    const lease = {
      id: "lease-1",
      endDate: date("2024-03-31"),
      cycle: "MONTHLY",
      status: "ACTIVE",
      autoRenew: true,
      room: { id: "room-1" }
    };
    vi.mocked(prisma.lease.findMany).mockResolvedValue([lease] as any);
    vi.mocked(prisma.lease.update).mockResolvedValue({ ...lease, endDate: date("2024-04-30") } as any);

    const result = await processAutoRenewLeases(date("2024-04-05"));

    expect(result.processedCount).toBe(1);
    expect(prisma.lease.update).toHaveBeenCalledWith({
      where: { id: "lease-1" },
      data: { endDate: date("2024-04-30") }
    });
    expect(generateLeaseBills).toHaveBeenCalledWith("lease-1", date("2024-04-05"));
  });

  it("should extend endDate across multiple periods if needed", async () => {
    const lease = {
      id: "lease-2",
      endDate: date("2024-01-15"),
      cycle: "MONTHLY",
      status: "ACTIVE",
      autoRenew: true,
      room: { id: "room-2" }
    };
    vi.mocked(prisma.lease.findMany).mockResolvedValue([lease] as any);
    vi.mocked(prisma.lease.update).mockResolvedValue({ ...lease, endDate: date("2024-05-15") } as any);

    const result = await processAutoRenewLeases(date("2024-05-05"));

    expect(result.processedCount).toBe(1);
    expect(prisma.lease.update).toHaveBeenCalledWith({
      where: { id: "lease-2" },
      data: { endDate: date("2024-05-15") }
    });
  });

  it("should skip leases that are not expired", async () => {
    vi.mocked(prisma.lease.findMany).mockResolvedValue([]);

    const result = await processAutoRenewLeases(date("2024-06-01"));

    expect(result.processedCount).toBe(0);
    expect(prisma.lease.update).not.toHaveBeenCalled();
    expect(generateLeaseBills).not.toHaveBeenCalled();
  });

  it("should stop at MAX_RENEWAL_PERIODS limit", async () => {
    const lease = {
      id: "lease-3",
      endDate: date("2023-01-31"),
      cycle: "MONTHLY",
      status: "ACTIVE",
      autoRenew: true,
      room: { id: "room-3" }
    };
    vi.mocked(prisma.lease.findMany).mockResolvedValue([lease] as any);

    const result = await processAutoRenewLeases(date("2025-01-01"));

    expect(result.processedCount).toBe(0);
    expect(prisma.lease.update).not.toHaveBeenCalled();
    expect(generateLeaseBills).not.toHaveBeenCalled();
  });
});
