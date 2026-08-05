import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { prisma } from '../config/prisma.js';

dayjs.extend(utc);

export type LeaseCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type LifecycleLeaseStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'TERMINATED'
  | 'EXPIRED';

export const cycleMonths: Record<LeaseCycle, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  YEARLY: 12,
};

type RenewalStateLease = {
  status: LifecycleLeaseStatus;
  endDate: Date;
};

type BillGenerationLease = RenewalStateLease & {
  startDate: Date;
  rentCycle: LeaseCycle;
};

/**
 * 获取租约日期的 UTC 当天开始时间（00:00:00）
 * @param date - 原始日期
 * @returns UTC 当天的开始时间
 */
export const startOfLeaseDay = (date: Date) => dayjs.utc(date).startOf('day');

/**
 * 判断租约是否处于自动续约期间（简化 schema 已移除 autoRenew，始终返回 false）
 * @param _lease - 租约对象
 * @param _today - 判断基准日期
 * @returns false
 */
export const isAutoRenewalPeriod = (
  _lease: RenewalStateLease,
  _today = new Date()
) => false;

/**
 * 判断非自动续约租约是否已过期
 * @param lease - 租约对象（含 status、endDate）
 * @param today - 判断基准日期，默认为当前日期
 * @returns 若为活跃租约且当前日期已超过结束日期，则返回 true
 */
export const hasExpired = (lease: RenewalStateLease, today = new Date()) =>
  lease.status === 'ACTIVE' &&
  startOfLeaseDay(today).isAfter(startOfLeaseDay(lease.endDate), 'day');

/**
 * 获取租约账单生成的结束日期
 * @param lease - 租约对象（含 status、startDate、endDate、rentCycle）
 * @param _today - 判断基准日期，默认为当前日期
 * @returns 账单生成的结束日期
 *   - 若租约已终止或过期，返回原结束日期
 *   - 否则返回租约原结束日期
 */
export const getLeaseBillGenerationEnd = (
  lease: BillGenerationLease,
  _today = new Date()
) => {
  return startOfLeaseDay(lease.endDate).toDate();
};

/**
 * 为租约对象附加生命周期状态字段
 * @param lease - 租约对象
 * @param today - 判断基准日期，默认为当前日期
 * @returns 包含 isAutoRenewalPeriod 和 hasExpired 状态的租约对象
 */
export const withLeaseLifecycle = <T extends RenewalStateLease>(
  lease: T,
  today = new Date()
) => ({
  ...lease,
  isAutoRenewalPeriod: isAutoRenewalPeriod(lease, today),
  hasExpired: hasExpired(lease, today),
});

/**
 * 将已过期的租约状态批量更新为 EXPIRED
 * @param today - 判断基准日期，默认为当前日期
 * @returns 包含过期租约数量的对象
 */
export const expireLeases = async (today = new Date()) => {
  const expired = await prisma.lease.updateMany({
    where: {
      status: 'ACTIVE',
      endDate: { lt: startOfLeaseDay(today).toDate() },
    },
    data: { status: 'EXPIRED' },
  });

  return { expiredCount: expired.count };
};
