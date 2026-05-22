import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('prisma config', () => {
  let prismaModule: any;
  let mockPrismaInstance: any;
  let middleware: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    mockPrismaInstance = {
      $use: vi.fn((fn: any) => {
        middleware = fn;
      }),
    };

    vi.doMock('@prisma/client', () => ({
      PrismaClient: vi.fn(function () {
        return mockPrismaInstance;
      }),
    }));

    vi.doMock('../../src/config/env.js', () => ({
      env: { NODE_ENV: 'development' },
    }));

    prismaModule = await import('../../src/config/prisma.js');
  });

  it('should create PrismaClient with warn and error logs in development', async () => {
    const { PrismaClient } = await import('@prisma/client');
    expect(PrismaClient).toHaveBeenCalledWith({ log: ['warn', 'error'] });
  });

  it('should soft-delete on delete action', async () => {
    const next = vi.fn(async (params: any) => params);
    const params = {
      action: 'delete',
      model: 'Lease',
      args: { where: { id: '1' } },
    };

    await middleware(params, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        args: expect.objectContaining({
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      })
    );
  });

  it('should soft-delete on deleteMany action', async () => {
    const next = vi.fn(async (params: any) => params);
    const params = {
      action: 'deleteMany',
      model: 'Bill',
      args: { where: { status: 'UNPAID' } },
    };

    await middleware(params, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'updateMany',
        args: expect.objectContaining({
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      })
    );
  });

  it('should auto-filter deletedAt for findMany', async () => {
    const next = vi.fn(async (params: any) => params);
    const params = {
      action: 'findMany',
      model: 'Apartment',
      args: { where: { name: 'A' } },
    };

    await middleware(params, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      })
    );
  });

  it('should not override explicit deletedAt filter', async () => {
    const next = vi.fn(async (params: any) => params);
    const params = {
      action: 'findMany',
      model: 'Room',
      args: { where: { deletedAt: new Date() } },
    };

    await middleware(params, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.objectContaining({
          where: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      })
    );
  });

  it('should not touch non-soft-delete models', async () => {
    const next = vi.fn(async (params: any) => params);
    const params = {
      action: 'delete',
      model: 'User',
      args: { where: { id: '1' } },
    };

    await middleware(params, next);

    expect(next).toHaveBeenCalledWith(params);
  });

  it('should create PrismaClient with only error log in production', async () => {
    vi.doMock('../../src/config/env.js', () => ({
      env: { NODE_ENV: 'production' },
    }));

    vi.resetModules();
    await import('../../src/config/prisma.js');
    const { PrismaClient } = await import('@prisma/client');
    expect(PrismaClient).toHaveBeenCalledWith({ log: ['error'] });
  });
});
