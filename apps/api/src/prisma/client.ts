import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { softDeleteExtension } from './extensions/soft-delete.js';

const basePrisma = new PrismaClient({
  log: env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
});

/**
 * 带软删除扩展的 Prisma Client
 *
 * 为支持软删除的模型提供类型安全的 API：
 * - softDelete / softDeleteMany
 * - restore / restoreMany
 * - findManyActive / findFirstActive / findFirstActiveOrThrow / countActive
 * - findManyWithDeleted
 *
 * 数据库级联软删除由 PostgreSQL 触发器处理，应用层无需手动级联。
 */
export const prisma = basePrisma.$extends(softDeleteExtension);

/**
 * 基础 Prisma Client（无扩展）。
 * 用于 `$transaction` 等需要严格 `TransactionClient` 类型的场景。
 */
export { basePrisma };
