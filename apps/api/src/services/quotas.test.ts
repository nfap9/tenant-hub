import { describe, expect, it, vi } from "vitest";
import { enforceOrganizationQuota, assertOrganizationQuota, getOrganizationQuota, isQuotaLimitEnabled } from "./quotas.js";

describe("quotas", () => {
  it("defaults quota limits to disabled when the setting is missing", async () => {
    const db = {
      systemSetting: {
        findUnique: vi.fn(async () => null)
      }
    };

    await expect(isQuotaLimitEnabled(db as never)).resolves.toBe(false);
  });

  it("does not require a subscription when quota limits are disabled by default", async () => {
    const db = {
      systemSetting: {
        findUnique: vi.fn(async () => null)
      },
      subscription: {
        findFirst: vi.fn()
      },
      orgQuotaPackage: {
        findMany: vi.fn()
      }
    };

    await expect(assertOrganizationQuota("org-1", "apartment", 1, db as never)).resolves.toBeUndefined();
    await expect(getOrganizationQuota("org-1", db as never)).resolves.toMatchObject({
      subscription: {
        id: "unlimited",
        plan: {
          name: "不限量"
        }
      }
    });
    expect(db.subscription.findFirst).not.toHaveBeenCalled();
    expect(db.orgQuotaPackage.findMany).not.toHaveBeenCalled();
  });

  it("skips quota locks and resource counts when quota limits are disabled", async () => {
    const db = {
      systemSetting: {
        findUnique: vi.fn(async () => ({ value: { enabled: false } }))
      },
      $executeRaw: vi.fn()
    };
    const getNextCount = vi.fn(async () => 2);

    await expect(enforceOrganizationQuota(db as never, "org-1", "apartment", getNextCount)).resolves.toBeUndefined();
    expect(db.$executeRaw).not.toHaveBeenCalled();
    expect(getNextCount).not.toHaveBeenCalled();
  });
});
