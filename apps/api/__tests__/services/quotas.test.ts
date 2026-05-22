import { describe, expect, it, vi } from 'vitest';
import {
  enforceOrganizationQuota,
  assertOrganizationQuota,
  getOrganizationQuota,
  isQuotaLimitEnabled,
} from '../../src/services/quotas.js';

describe('quotas', () => {
  it('defaults quota limits to disabled when the setting is missing', async () => {
    const db = {
      systemSetting: {
        findUnique: vi.fn(async () => null),
      },
    };

    await expect(isQuotaLimitEnabled(db as never)).resolves.toBe(false);
  });

  it('does not require a subscription when quota limits are disabled by default', async () => {
    const db = {
      systemSetting: {
        findUnique: vi.fn(async () => null),
      },
      subscription: {
        findFirst: vi.fn(),
      },
      orgQuotaPackage: {
        findMany: vi.fn(),
      },
    };

    await expect(
      assertOrganizationQuota('org-1', 'apartment', 1, db as never)
    ).resolves.toBeUndefined();
    await expect(
      getOrganizationQuota('org-1', db as never)
    ).resolves.toMatchObject({
      subscription: {
        id: 'unlimited',
        plan: {
          name: '不限量',
        },
      },
    });
    expect(db.subscription.findFirst).not.toHaveBeenCalled();
    expect(db.orgQuotaPackage.findMany).not.toHaveBeenCalled();
  });

  it('skips quota locks and resource counts when quota limits are disabled', async () => {
    const db = {
      systemSetting: {
        findUnique: vi.fn(async () => ({ value: { enabled: false } })),
      },
      $executeRaw: vi.fn(),
    };
    const getNextCount = vi.fn(async () => 2);

    await expect(
      enforceOrganizationQuota(db as never, 'org-1', 'apartment', getNextCount)
    ).resolves.toBeUndefined();
    expect(db.$executeRaw).not.toHaveBeenCalled();
    expect(getNextCount).not.toHaveBeenCalled();
  });

  it('should enable quota limits when setting is true', async () => {
    const db = {
      systemSetting: {
        findUnique: vi.fn(async () => ({ value: { enabled: true } })),
      },
    };

    await expect(isQuotaLimitEnabled(db as never)).resolves.toBe(true);
  });

  it('should get organization quota with subscription and extras', async () => {
    const db = {
      systemSetting: {
        findUnique: vi.fn(async () => ({ value: { enabled: true } })),
      },
      subscription: {
        findFirst: vi.fn(async () => ({
          id: 'sub-1',
          plan: { apartmentLimit: 5, roomLimit: 20, memberLimit: 10 },
        })),
      },
      orgQuotaPackage: {
        findMany: vi.fn(async () => [
          { apartmentQuota: 2, roomQuota: 5, memberQuota: 3 },
        ]),
      },
    };

    const result = await getOrganizationQuota('org-1', db as never);
    expect(result).toMatchObject({
      subscription: { id: 'sub-1', plan: { apartmentLimit: 5 } },
      extraQuota: { apartmentQuota: 2, roomQuota: 5, memberQuota: 3 },
    });
  });

  it('should throw when quota exceeds limit', async () => {
    const db = {
      systemSetting: {
        findUnique: vi.fn(async () => ({ value: { enabled: true } })),
      },
      subscription: {
        findFirst: vi.fn(async () => ({
          id: 'sub-1',
          plan: { apartmentLimit: 2, roomLimit: 5, memberLimit: 3 },
        })),
      },
      orgQuotaPackage: {
        findMany: vi.fn(async () => []),
      },
    };

    await expect(
      assertOrganizationQuota('org-1', 'apartment', 3, db as never)
    ).rejects.toThrow(/公寓数量已达到套餐额度上限/);
  });

  it('should throw when no active subscription and quota enabled', async () => {
    const db = {
      systemSetting: {
        findUnique: vi.fn(async () => ({ value: { enabled: true } })),
      },
      subscription: {
        findFirst: vi.fn(async () => null),
      },
      orgQuotaPackage: {
        findMany: vi.fn(async () => []),
      },
    };

    await expect(
      assertOrganizationQuota('org-1', 'room', 1, db as never)
    ).rejects.toThrow(/请先购买套餐/);
  });

  it('should enforce quota with lock when enabled', async () => {
    const db = {
      systemSetting: {
        findUnique: vi.fn(async () => ({ value: { enabled: true } })),
      },
      subscription: {
        findFirst: vi.fn(async () => ({
          id: 'sub-1',
          plan: { apartmentLimit: 5, roomLimit: 5, memberLimit: 5 },
        })),
      },
      orgQuotaPackage: {
        findMany: vi.fn(async () => []),
      },
      $executeRaw: vi.fn(),
    };
    const getNextCount = vi.fn(async () => 3);

    await expect(
      enforceOrganizationQuota(db as never, 'org-1', 'room', getNextCount)
    ).resolves.toBeUndefined();
    expect(db.$executeRaw).toHaveBeenCalled();
    expect(getNextCount).toHaveBeenCalled();
  });
});
