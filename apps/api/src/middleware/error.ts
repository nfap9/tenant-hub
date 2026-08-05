import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { HttpError } from '../utils/http.js';

/**
 * 统一错误处理中间件
 * 处理 HttpError、ZodError、Prisma 已知错误及其他未知错误
 * @param err - 捕获到的错误对象
 * @param _req - Express 请求对象
 * @param res - Express 响应对象
 * @param _next - Express 下一个中间件函数
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  if (err?.name === 'ZodError') {
    return res
      .status(400)
      .json({ error: '参数不正确', details: err.flatten?.() });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002')
      return res.status(409).json({ error: '数据已存在，不能重复创建' });
    if (err.code === 'P2003')
      return res.status(400).json({ error: '数据仍被关联使用，无法完成操作' });
    if (err.code === 'P2025')
      return res.status(404).json({ error: '数据不存在' });
  }

  console.error(err);
  return res.status(500).json({ error: '服务器内部错误' });
};
