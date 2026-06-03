import cron from 'node-cron';
import { processAutoRenewLeases } from './autoRenew.js';
import { generateCurrentLeaseBills } from './billing.js';
import { expireLeases } from './leaseLifecycle.js';
import { prisma } from '../config/prisma.js';

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

    // 1. Expire non-auto-renew leases past their end date
    const expireResult = await expireLeases();
    console.info(
      `[Scheduler] 租约过期处理完成: ${expireResult.expiredCount} 条`
    );

    // 2. Release reservations whose expected move-in date has passed
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiredReservations = await prisma.reservation.findMany({
      where: { expectedMoveInDate: { lt: today } },
      select: { roomId: true },
    });
    if (expiredReservations.length > 0) {
      const roomIds = expiredReservations.map((r) => r.roomId);
      await prisma.$transaction([
        prisma.reservation.deleteMany({
          where: { roomId: { in: roomIds } },
        }),
        prisma.room.updateMany({
          where: { id: { in: roomIds }, status: 'RESERVED' },
          data: { status: 'VACANT' },
        }),
      ]);
      console.info(
        `[Scheduler] 预订自动释放完成: ${expiredReservations.length} 间`
      );
    }

    // 3. Auto-renew leases that have expired with autoRenew=true
    const renewResult = await processAutoRenewLeases();
    console.info(`[Scheduler] 自动续约完成: ${renewResult.processedCount} 条`);

    // 4. Generate bills for all active organizations
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
