import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { prisma } from '../config/prisma.js';
import { cycleMonths } from './leaseLifecycle.js';
import { generateLeaseBills } from './billing.js';

dayjs.extend(utc);

const startOfDay = (date: Date) => dayjs.utc(date).startOf('day');

const MAX_RENEWAL_PERIODS = 12;

/**
 * 处理自动续约租约
 * 查找已到期的、开启自动续约的活跃租约，按租赁周期逐次延长结束日期，
 * 并为新延长的周期生成账单。最大续约次数为 12 个周期。
 * @param today - 指定处理日期，默认为当前日期
 * @returns 返回处理结果，包含本次成功处理的租约数量 processedCount
 */
export const processAutoRenewLeases = async (today = new Date()) => {
  const todayStart = startOfDay(today);

  const expiredAutoRenewLeases = await prisma.lease.findMany({
    where: {
      autoRenew: true,
      status: 'ACTIVE',
      endDate: { lt: todayStart.toDate() },
    },
    include: { room: true },
  });

  let processedCount = 0;

  for (const lease of expiredAutoRenewLeases) {
    let newEndDate = startOfDay(lease.endDate);
    const months = cycleMonths[lease.cycle];
    let periodsExtended = 0;

    // Extend endDate one cycle at a time until it reaches or passes today
    while (
      newEndDate.isBefore(todayStart, 'day') &&
      periodsExtended < MAX_RENEWAL_PERIODS
    ) {
      newEndDate = newEndDate.add(months, 'month');
      periodsExtended++;
    }

    if (
      periodsExtended >= MAX_RENEWAL_PERIODS &&
      newEndDate.isBefore(todayStart, 'day')
    ) {
      console.warn(
        `[AutoRenew] 租约 ${lease.id} 已超过最大续约次数 (${MAX_RENEWAL_PERIODS}), 停止自动续约`
      );
      continue;
    }

    await prisma.lease.update({
      where: { id: lease.id },
      data: { endDate: newEndDate.toDate() },
    });

    // Generate bills for the newly extended period
    await generateLeaseBills(lease.id, today);
    processedCount++;
  }

  return { processedCount };
};
