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
  autoRenew: boolean;
  status: LifecycleLeaseStatus;
  endDate: Date;
};

type BillGenerationLease = RenewalStateLease & {
  startDate: Date;
  cycle: LeaseCycle;
  terminatedAt?: Date | null;
};

/**
 * 获取租约日期的 UTC 当天开始时间（00:00:00）
 * @param date - 原始日期
 * @returns UTC 当天的开始时间
 */
export const startOfLeaseDay = (date: Date) => dayjs.utc(date).startOf('day');

/**
 * 判断租约是否处于自动续约期间
 * @param lease - 租约对象（含 autoRenew、status、endDate）
 * @param today - 判断基准日期，默认为当前日期
 * @returns 若为自动续约租约且当前日期已超过结束日期，则返回 true
 */
export const isAutoRenewalPeriod = (
  lease: RenewalStateLease,
  today = new Date()
) =>
  lease.autoRenew &&
  lease.status === 'ACTIVE' &&
  startOfLeaseDay(today).isAfter(startOfLeaseDay(lease.endDate), 'day');

/**
 * 判断非自动续约租约是否已过期
 * @param lease - 租约对象（含 status、autoRenew、endDate）
 * @param today - 判断基准日期，默认为当前日期
 * @returns 若为非自动续约的活跃租约且当前日期已超过结束日期，则返回 true
 */
export const hasExpired = (lease: RenewalStateLease, today = new Date()) =>
  lease.status === 'ACTIVE' &&
  !lease.autoRenew &&
  startOfLeaseDay(today).isAfter(startOfLeaseDay(lease.endDate), 'day');

/**
 * 获取租约账单生成的结束日期
 * @param lease - 租约对象（含 status、startDate、endDate、cycle、autoRenew、terminatedAt）
 * @param today - 判断基准日期，默认为当前日期
 * @returns 账单生成的结束日期
 *   - 若租约已退租，返回退租日期
 *   - 若租约为自动续约，返回下一计费周期的结束日期
 *   - 否则返回租约原结束日期
 */
export const getLeaseBillGenerationEnd = (
  lease: BillGenerationLease,
  today = new Date()
) => {
  if (lease.status === 'TERMINATED' && lease.terminatedAt) {
    return startOfLeaseDay(lease.terminatedAt).toDate();
  }

  if (lease.autoRenew && lease.status === 'ACTIVE') {
    const months = cycleMonths[lease.cycle];
    const todayDay = startOfLeaseDay(today);
    let periodStart = startOfLeaseDay(lease.startDate);
    let periodEnd = periodStart.add(months, 'month').subtract(1, 'day');

    while (periodEnd.isBefore(todayDay, 'day')) {
      periodStart = periodStart.add(months, 'month');
      periodEnd = periodStart.add(months, 'month').subtract(1, 'day');
    }

    return periodEnd.add(months, 'month').toDate();
  }

  return startOfLeaseDay(lease.endDate).toDate();
};

/**
 * 校验到期解约的退租日期是否合法
 * @param endDate - 租约原结束日期
 * @param terminatedAt - 退租日期
 * @throws 若退租日期早于原结束日期，则抛出错误
 */
export const assertExpiredTerminationAllowed = (
  endDate: Date,
  terminatedAt: Date
) => {
  if (startOfLeaseDay(terminatedAt).isBefore(startOfLeaseDay(endDate), 'day')) {
    throw new Error('到期解约的退租日期不能早于原租约结束日期');
  }
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
 * 将已过期的非自动续约租约状态批量更新为 EXPIRED
 * @param today - 判断基准日期，默认为当前日期
 * @returns 包含过期租约数量的对象
 */
export const expireLeases = async (today = new Date()) => {
  const expired = await prisma.lease.updateMany({
    where: {
      status: 'ACTIVE',
      autoRenew: false,
      endDate: { lt: startOfLeaseDay(today).toDate() },
    },
    data: { status: 'EXPIRED' },
  });

  return { expiredCount: expired.count };
};
