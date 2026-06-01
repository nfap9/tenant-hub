import { prisma } from '../prisma/client.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { cycleMonths, type LeaseCycle } from './leaseLifecycle.js';
import { generateLeaseBills } from './billing.js';
import { HttpError } from '../utils/http.js';

dayjs.extend(utc);

const startOfDay = (date: Date) => dayjs.utc(date).startOf('day');

export const populateBillQueue = async (leaseId: string) => {
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
  });
  if (!lease) throw new HttpError(404, '租约不存在');

  const billDay = lease.billDay ?? startOfDay(lease.startDate).date();
  const clampedDay = Math.min(billDay, 28);

  let cursor = startOfDay(lease.startDate);
  if (cursor.date() < clampedDay) {
    cursor = cursor.date(clampedDay);
  } else if (cursor.date() > clampedDay) {
    cursor = cursor.add(1, 'month').date(clampedDay);
  }

  const existingQueue = await prisma.billQueue.findUnique({
    where: { leaseId: lease.id },
  });
  if (existingQueue) return existingQueue;

  const nextBillDate = cursor.isBefore(startOfDay(new Date()), 'day')
    ? null
    : cursor.toDate();

  return prisma.billQueue.create({
    data: {
      leaseId: lease.id,
      nextBillDate: nextBillDate ?? cursor.toDate(),
      status: 'PENDING',
    },
  });
};

export const processBillQueue = async (
  organizationId: string,
  today = new Date()
) => {
  const queues = await prisma.billQueue.findMany({
    where: {
      status: { in: ['PENDING', 'FAILED'] },
      nextBillDate: { lte: startOfDay(today).endOf('day').toDate() },
      lease: { organizationId, status: 'ACTIVE' },
    },
    include: { lease: true },
  });

  const results: { queueId: string; billIds: string[]; error?: string }[] = [];

  for (const queue of queues) {
    try {
      await prisma.billQueue.update({
        where: { id: queue.id },
        data: { status: 'PROCESSING' },
      });

      const billIds = await generateLeaseBills(queue.leaseId, today);

      const months = cycleMonths[queue.lease.cycle as LeaseCycle];
      const billDay =
        queue.lease.billDay ?? startOfDay(queue.lease.startDate).date();
      const clampedDay = Math.min(billDay, 28);
      const nextDate = startOfDay(queue.nextBillDate)
        .add(months, 'month')
        .date(clampedDay);

      const leaseEnd = startOfDay(queue.lease.endDate);
      const isPastEnd = nextDate.isAfter(leaseEnd, 'day');

      await prisma.billQueue.update({
        where: { id: queue.id },
        data: {
          status: isPastEnd ? 'DONE' : 'PENDING',
          nextBillDate: nextDate.toDate(),
          lastBillDate: queue.nextBillDate,
          lastBillId: billIds?.[0] ?? null,
          updatedAt: new Date(),
        },
      });

      results.push({ queueId: queue.id, billIds: billIds ?? [] });
    } catch (error) {
      await prisma.billQueue.update({
        where: { id: queue.id },
        data: {
          status: 'FAILED',
          errorMsg: error instanceof Error ? error.message : '出账失败',
          updatedAt: new Date(),
        },
      });
      results.push({
        queueId: queue.id,
        billIds: [],
        error: error instanceof Error ? error.message : '出账失败',
      });
    }
  }

  return results;
};

export const skipBillQueueEntry = async (queueId: string) => {
  const queue = await prisma.billQueue.findUnique({ where: { id: queueId } });
  if (!queue) throw new HttpError(404, '出账队列条目不存在');

  const lease = await prisma.lease.findUnique({ where: { id: queue.leaseId } });
  if (!lease) throw new HttpError(404, '关联租约不存在');

  const months = cycleMonths[lease.cycle as LeaseCycle];
  const billDay = lease.billDay ?? startOfDay(lease.startDate).date();
  const clampedDay = Math.min(billDay, 28);
  const nextDate = startOfDay(queue.nextBillDate)
    .add(months, 'month')
    .date(clampedDay);

  return prisma.billQueue.update({
    where: { id: queueId },
    data: {
      status: 'SKIPPED',
      lastBillDate: queue.nextBillDate,
      nextBillDate: nextDate.toDate(),
      updatedAt: new Date(),
    },
  });
};
