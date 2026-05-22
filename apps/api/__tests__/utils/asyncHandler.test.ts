import { describe, it, expect, vi } from 'vitest';
import { asyncHandler } from '../../src/utils/asyncHandler.js';

describe('asyncHandler', () => {
  it('should pass resolved value and not call next on success', async () => {
    const fn = vi.fn(async (_req, _res, _next) => 'ok');
    const wrapped = asyncHandler(fn);
    const req = {} as any;
    const res = {} as any;
    const next = vi.fn();

    wrapped(req, res, next);
    await new Promise((r) => setTimeout(r, 0));

    expect(fn).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next with error when promise rejects', async () => {
    const error = new Error('fail');
    const fn = vi.fn(async () => {
      throw error;
    });
    const wrapped = asyncHandler(fn);
    const req = {} as any;
    const res = {} as any;
    const next = vi.fn();

    wrapped(req, res, next);
    await new Promise((r) => setTimeout(r, 0));

    expect(next).toHaveBeenCalledWith(error);
  });
});
