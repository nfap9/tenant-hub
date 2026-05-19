import { describe, it, expect, vi } from "vitest";
import { ensurePlatformAdmin, ensureSystemSettings } from "../../src/services/adminInit.js";

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(async () => "hashed-password")
  }
}));

describe("admin init", () => {
  it("should skip when env is not configured", async () => {
    const mockFindUnique = vi.fn();
    const mockCreate = vi.fn();

    await ensurePlatformAdmin({
      env: { PLATFORM_ADMIN_PHONE: "", PLATFORM_ADMIN_PASSWORD: "", BCRYPT_PASSWORD_SALT_ROUNDS: 12 },
      prisma: { user: { findUnique: mockFindUnique, create: mockCreate } } as never
    });

    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("should skip when admin already exists", async () => {
    const mockFindUnique = vi.fn(async () => ({ id: "user-1", phone: "13800138000" }));
    const mockCreate = vi.fn();

    await ensurePlatformAdmin({
      env: { PLATFORM_ADMIN_PHONE: "13800138000", PLATFORM_ADMIN_PASSWORD: "secure-password-123", BCRYPT_PASSWORD_SALT_ROUNDS: 12 },
      prisma: { user: { findUnique: mockFindUnique, create: mockCreate } } as never
    });

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { phone: "13800138000" } });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("should create super admin when not exists", async () => {
    const mockFindUnique = vi.fn(async () => null);
    const mockCreate = vi.fn();

    await ensurePlatformAdmin({
      env: { PLATFORM_ADMIN_PHONE: "13800138000", PLATFORM_ADMIN_PASSWORD: "secure-password-123", BCRYPT_PASSWORD_SALT_ROUNDS: 12 },
      prisma: { user: { findUnique: mockFindUnique, create: mockCreate } } as never
    });

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { phone: "13800138000" } });
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phone: "13800138000",
        username: "超级管理员",
        passwordHash: "hashed-password",
        platformRole: "SUPER_ADMIN"
      })
    });
  });

  describe("ensureSystemSettings", () => {
    it("should create missing settings", async () => {
      const mockFindUnique = vi.fn(async () => null);
      const mockCreate = vi.fn();

      await ensureSystemSettings({
        prisma: { systemSetting: { findUnique: mockFindUnique, create: mockCreate } } as never
      });

      expect(mockFindUnique).toHaveBeenCalledTimes(2);
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ key: "quota_limit_enabled", value: { enabled: false } })
        })
      );
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ key: "platform_info" })
        })
      );
    });

    it("should skip existing settings", async () => {
      const mockFindUnique = vi.fn(async () => ({ id: "setting-1", key: "quota_limit_enabled", value: { enabled: false } }));
      const mockCreate = vi.fn();

      await ensureSystemSettings({
        prisma: { systemSetting: { findUnique: mockFindUnique, create: mockCreate } } as never
      });

      expect(mockFindUnique).toHaveBeenCalledTimes(2);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
});
