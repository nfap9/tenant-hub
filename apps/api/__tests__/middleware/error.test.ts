import { describe, it, expect, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { errorHandler } from '../../src/middleware/error.js';
import { HttpError } from '../../src/utils/http.js';

const mockRes = () => {
  const json = vi.fn();
  return {
    status: vi.fn(() => ({ json })),
    json,
  } as any;
};

describe('errorHandler', () => {
  it('should handle HttpError with status', () => {
    const res = mockRes();
    errorHandler(new HttpError(403, 'forbidden'), {} as any, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'forbidden' });
  });

  it('should handle ZodError with 400', () => {
    const res = mockRes();
    const zodError: any = new Error('invalid');
    zodError.name = 'ZodError';
    zodError.flatten = () => ({ fieldErrors: {} });
    errorHandler(zodError, {} as any, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: '参数不正确' })
    );
  });

  it('should handle Prisma P2002 as 409', () => {
    const res = mockRes();
    const error = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: '5',
    });
    errorHandler(error, {} as any, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: '数据已存在，不能重复创建',
    });
  });

  it('should handle Prisma P2003 as 400', () => {
    const res = mockRes();
    const error = new Prisma.PrismaClientKnownRequestError('foreign key', {
      code: 'P2003',
      clientVersion: '5',
    });
    errorHandler(error, {} as any, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: '数据仍被关联使用，无法完成操作',
    });
  });

  it('should handle Prisma P2025 as 404', () => {
    const res = mockRes();
    const error = new Prisma.PrismaClientKnownRequestError('not found', {
      code: 'P2025',
      clientVersion: '5',
    });
    errorHandler(error, {} as any, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: '数据不存在' });
  });

  it('should handle unknown errors as 500', () => {
    const res = mockRes();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    errorHandler(new Error('boom'), {} as any, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: '服务器内部错误' });
    consoleSpy.mockRestore();
  });
});
