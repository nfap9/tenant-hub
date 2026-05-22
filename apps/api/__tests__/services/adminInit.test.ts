import { describe, it, expect, vi } from 'vitest';
import { ensureSystemSettings } from '../../src/services/adminInit.js';

describe('admin init', () => {
  describe('ensureSystemSettings', () => {
    it('should create missing settings', async () => {
      const mockFindUnique = vi.fn(async () => null);
      const mockCreate = vi.fn();

      await ensureSystemSettings({
        prisma: {
          systemSetting: { findUnique: mockFindUnique, create: mockCreate },
        } as never,
      });

      expect(mockFindUnique).toHaveBeenCalledTimes(2);
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            key: 'quota_limit_enabled',
            value: { enabled: false },
          }),
        })
      );
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ key: 'platform_info' }),
        })
      );
    });

    it('should skip existing settings', async () => {
      const mockFindUnique = vi.fn(async () => ({
        id: 'setting-1',
        key: 'quota_limit_enabled',
        value: { enabled: false },
      }));
      const mockCreate = vi.fn();

      await ensureSystemSettings({
        prisma: {
          systemSetting: { findUnique: mockFindUnique, create: mockCreate },
        } as never,
      });

      expect(mockFindUnique).toHaveBeenCalledTimes(2);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
});
