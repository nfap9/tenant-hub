import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('scheduler', () => {
  let runDailyTasks: any;
  let startScheduler: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    vi.doMock('node-cron', () => ({
      default: { schedule: vi.fn() },
    }));

    vi.doMock('../../src/services/autoRenew.js', () => ({
      processAutoRenewLeases: vi.fn(async () => ({ processedCount: 2 })),
    }));

    vi.doMock('../../src/services/billing.js', () => ({
      generateCurrentLeaseBills: vi.fn(async () => ['bill-1']),
    }));

    vi.doMock('../../src/config/prisma.js', () => ({
      prisma: {
        organization: {
          findMany: vi.fn(async () => [{ id: 'org-1' }, { id: 'org-2' }]),
        },
      },
    }));

    const scheduler = await import('../../src/services/scheduler.js');
    runDailyTasks = scheduler.runDailyTasks;
    startScheduler = scheduler.startScheduler;
  });

  it('should run daily tasks in order', async () => {
    const { processAutoRenewLeases } =
      await import('../../src/services/autoRenew.js');
    const { generateCurrentLeaseBills } =
      await import('../../src/services/billing.js');

    await runDailyTasks();

    expect(processAutoRenewLeases).toHaveBeenCalledTimes(1);
    expect(generateCurrentLeaseBills).toHaveBeenCalledTimes(2);
    expect(generateCurrentLeaseBills).toHaveBeenCalledWith('org-1');
    expect(generateCurrentLeaseBills).toHaveBeenCalledWith('org-2');
  });

  it('should skip if already running', async () => {
    const { processAutoRenewLeases } =
      await import('../../src/services/autoRenew.js');

    const first = runDailyTasks();
    const second = runDailyTasks();

    await Promise.all([first, second]);

    expect(processAutoRenewLeases).toHaveBeenCalledTimes(1);
  });

  it('should schedule cron job on start', async () => {
    const cron = await import('node-cron');

    startScheduler();

    expect(cron.default.schedule).toHaveBeenCalledWith(
      '0 2 * * *',
      runDailyTasks,
      expect.objectContaining({ timezone: 'Asia/Shanghai' })
    );
  });
});
