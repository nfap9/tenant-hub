import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-123456789',
    JWT_EXPIRES_IN: '7d',
    NODE_ENV: 'test',
  },
}));

vi.mock('../../src/config/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    orgMember: {
      findUnique: vi.fn(),
    },
  },
}));

import {
  isTokenStaleForPasswordChange,
  requireAuth,
  requireOrg,
  requirePermission,
  requirePlatformAccess,
} from '../../src/middleware/auth.js';
import { prisma } from '../../src/config/prisma.js';

describe('auth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should remain valid when the user has never changed password', () => {
    expect(
      isTokenStaleForPasswordChange(new Date('2026-05-07T10:00:00.000Z'), null)
    ).toBe(false);
  });

  it('should mark tokens issued before a password change as stale', () => {
    expect(
      isTokenStaleForPasswordChange(
        new Date('2026-05-07T10:00:00.000Z'),
        new Date('2026-05-07T10:00:02.000Z')
      )
    ).toBe(true);
  });

  it('should tolerate JWT iat second precision for same-second tokens', () => {
    expect(
      isTokenStaleForPasswordChange(
        new Date('2026-05-07T10:00:00.000Z'),
        new Date('2026-05-07T10:00:00.500Z')
      )
    ).toBe(false);
  });
});

describe('requireAuth', () => {
  const secret = 'test-jwt-secret-123456789';

  it('should throw 401 when no token', () => {
    const req: any = { headers: {} };
    const res: any = {};
    const next = vi.fn();

    expect(() => requireAuth(req, res, next)).toThrow(
      expect.objectContaining({ status: 401 })
    );
  });

  it('should set req.user on valid token', async () => {
    const token = jwt.sign(
      { id: 'user-1', phone: '13800138000', username: '测试用户' },
      secret
    );
    const req: any = { headers: { authorization: `Bearer ${token}` } };
    const res: any = {};
    const next = vi.fn();

    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'user-1',
      phone: '13800138000',
      username: '测试用户',
      passwordChangedAt: null,
    });

    requireAuth(req, res, next);
    await new Promise((r) => setTimeout(r, 0));

    expect(req.user).toEqual({
      id: 'user-1',
      phone: '13800138000',
      username: '测试用户',
    });
    expect(next).toHaveBeenCalledWith();
  });

  it('should call next with 401 for invalid token', async () => {
    const req: any = { headers: { authorization: 'Bearer invalid-token' } };
    const res: any = {};
    const next = vi.fn();

    requireAuth(req, res, next);
    await new Promise((r) => setTimeout(r, 0));

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  it('should call next with 401 when user not found', async () => {
    const token = jwt.sign(
      { id: 'user-1', phone: '13800138000', username: '测试用户' },
      secret
    );
    const req: any = { headers: { authorization: `Bearer ${token}` } };
    const res: any = {};
    const next = vi.fn();

    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );

    requireAuth(req, res, next);
    await new Promise((r) => setTimeout(r, 0));

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });
});

describe('requireOrg', () => {
  const mockReq = (overrides: any = {}) => ({
    user: overrides.user,
    header: (name: string) => overrides.headers?.[name.toLowerCase()],
    headers: overrides.headers ?? {},
    params: overrides.params ?? {},
  });

  it('should call next with 401 when no user', async () => {
    const req = mockReq({ user: undefined });
    const res: any = {};
    const next = vi.fn();

    requireOrg(req, res, next);
    await new Promise((r) => setTimeout(r, 0));

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  it('should call next with 400 when no organization header', async () => {
    const req = mockReq({ user: { id: 'user-1' } });
    const res: any = {};
    const next = vi.fn();

    requireOrg(req, res, next);
    await new Promise((r) => setTimeout(r, 0));

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
  });

  it('should set req.organizationId and req.permissions on valid member', async () => {
    const req = mockReq({
      user: { id: 'user-1' },
      headers: { 'x-organization-id': 'org-1' },
    });
    const res: any = {};
    const next = vi.fn();

    (prisma.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        status: 'ACTIVE',
        role: { permissions: ['LEASE_VIEW'] },
      }
    );

    requireOrg(req, res, next);
    await new Promise((r) => setTimeout(r, 0));

    expect(req.organizationId).toBe('org-1');
    expect(req.permissions).toEqual(['LEASE_VIEW']);
    expect(next).toHaveBeenCalledWith();
  });

  it('should call next with 403 when member not active', async () => {
    const req = mockReq({
      user: { id: 'user-1' },
      headers: { 'x-organization-id': 'org-1' },
    });
    const res: any = {};
    const next = vi.fn();

    (prisma.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        status: 'DISABLED',
        role: { permissions: [] },
      }
    );

    requireOrg(req, res, next);
    await new Promise((r) => setTimeout(r, 0));

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  it('should call next with 403 when member not found', async () => {
    const req = mockReq({
      user: { id: 'user-1' },
      headers: { 'x-organization-id': 'org-1' },
    });
    const res: any = {};
    const next = vi.fn();

    (prisma.orgMember.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );

    requireOrg(req, res, next);
    await new Promise((r) => setTimeout(r, 0));

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });
});

describe('requirePermission', () => {
  it('should call next when permission matches', () => {
    const req: any = { permissions: ['LEASE_VIEW', 'LEASE_MANAGE'] };
    const res: any = {};
    const next = vi.fn();

    requirePermission('LEASE_MANAGE')(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should call next with wildcard permission', () => {
    const req: any = { permissions: ['*'] };
    const res: any = {};
    const next = vi.fn();

    requirePermission('ANY_PERMISSION')(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should throw 403 when permission missing', () => {
    const req: any = { permissions: ['LEASE_VIEW'] };
    const res: any = {};
    const next = vi.fn();

    expect(() => requirePermission('LEASE_MANAGE')(req, res, next)).toThrow(
      expect.objectContaining({ status: 403 })
    );
  });

  it('should throw 403 when no permissions', () => {
    const req: any = { permissions: undefined };
    const res: any = {};
    const next = vi.fn();

    expect(() => requirePermission('LEASE_MANAGE')(req, res, next)).toThrow(
      expect.objectContaining({ status: 403 })
    );
  });
});

describe('requirePlatformAccess', () => {
  it('should allow SUPER_ADMIN', async () => {
    const req: any = { user: { id: 'user-1', phone: '13800138000' } };
    const res: any = {};
    const next = vi.fn();

    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      platformRole: 'SUPER_ADMIN',
    });

    requirePlatformAccess(req, res, next);
    await new Promise((r) => setTimeout(r, 0));

    expect(next).toHaveBeenCalledWith();
  });

  it('should reject USER', async () => {
    const req: any = { user: { id: 'user-1', phone: '13800138001' } };
    const res: any = {};
    const next = vi.fn();

    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      platformRole: 'USER',
    });

    requirePlatformAccess(req, res, next);
    await new Promise((r) => setTimeout(r, 0));

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });
});
