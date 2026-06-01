import cron from 'node-cron';
import { processAutoRenewLeases } from './autoRenew.js';
import { generateCurrentLeaseBills } from './billing.js';
import { markOverdueBills, calculateOverduePenalties } from './overdue.js';
import { processLeaseExpirations } from './leaseExpiration.js';
import { prisma } from '../prisma/client.js';

let running = false;

export const runDailyTasks = async () => {
  if (running) {
    console.warn('[Scheduler] 上次任务仍在执行，跳过本次');
    return;
  }
  running = true;
  const start = Date.now();

  try {
    console.info('[Scheduler] 开始执行每日任务');

    // 1. Auto-renew leases that have expired with autoRenew=true
    const renewResult = await processAutoRenewLeases();
    console.info(`[Scheduler] 自动续约完成: ${renewResult.processedCount} 条`);

    // 2. Generate bills for all active organizations
    const activeOrgs = await prisma.organization.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    for (const org of activeOrgs) {
      try {
        await generateCurrentLeaseBills(org.id);
      } catch (error) {
        console.error(`[Scheduler] 组织 ${org.id} 账单生成失败`, error);
      }
    }

    // 3. Mark overdue bills
    try {
      const overdueCount = await markOverdueBills();
      console.info(`[Scheduler] 逾期账单标记完成: ${overdueCount} 条`);
    } catch (error) {
      console.error('[Scheduler] 逾期账单标记失败', error);
    }

    // 4. Calculate overdue penalties
    try {
      const penaltyCount = await calculateOverduePenalties();
      console.info(`[Scheduler] 滞纳金计算完成: ${penaltyCount} 条`);
    } catch (error) {
      console.error('[Scheduler] 滞纳金计算失败', error);
    }

    // 5. Process lease expirations (EXPIRING_SOON / EXPIRED)
    try {
      const { expiringSoonCount, expiredCount } =
        await processLeaseExpirations();
      console.info(
        `[Scheduler] 租约到期处理完成: ${expiringSoonCount} 条即将到期, ${expiredCount} 条已过期`
      );
    } catch (error) {
      console.error('[Scheduler] 租约到期处理失败', error);
    }

    console.info(`[Scheduler] 每日任务完成, 耗时 ${Date.now() - start}ms`);
  } catch (error) {
    console.error('[Scheduler] 每日任务异常', error);
  } finally {
    running = false;
  }
};

export const startScheduler = () => {
  // Run daily at 02:00 Asia/Shanghai
  cron.schedule('0 2 * * *', runDailyTasks, {
    timezone: 'Asia/Shanghai',
  });

  console.info('[Scheduler] 定时任务已启动 (每日 02:00 Asia/Shanghai)');
};
