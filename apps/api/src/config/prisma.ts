import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
});

const SOFT_DELETE_MODELS = [
  'Apartment',
  'Room',
  'Lease',
  'Bill',
  'BillItem',
  'Deposit',
];

/**
 * Prisma 软删除中间件
 * 对指定模型的 delete/deleteMany 操作转换为更新 deletedAt，
 * 并在查询时自动过滤已软删除的记录（除非显式指定 deletedAt 条件）
 * @param params - Prisma 操作参数
 * @param next - 下一个 Prisma 中间件函数
 */
prisma.$use(async (params, next) => {
  if (!params.model || !SOFT_DELETE_MODELS.includes(params.model)) {
    return next(params);
  }

  // Delete operations → soft delete by setting deletedAt
  if (params.action === 'delete') {
    params.action = 'update';
    params.args.data = { ...params.args.data, deletedAt: new Date() };
  }
  if (params.action === 'deleteMany') {
    params.action = 'updateMany';
    params.args.data = { ...params.args.data, deletedAt: new Date() };
  }

  // Query operations → auto-filter out soft-deleted records
  // unless the caller explicitly specifies a deletedAt condition
  if (
    ['findMany', 'findFirst', 'findFirstOrThrow', 'count'].includes(
      params.action
    )
  ) {
    if (params.args?.where?.deletedAt === undefined) {
      params.args = {
        ...params.args,
        where: { ...params.args?.where, deletedAt: null },
      };
    }
  }

  return next(params);
});
