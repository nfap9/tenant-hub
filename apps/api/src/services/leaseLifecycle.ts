import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);

export type LeaseCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type LifecycleLeaseStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'ACTIVE'
  | 'EXPIRING_SOON'
  | 'TERMINATING'
  | 'TERMINATED'
  | 'EXPIRED'
  | 'RENEWED'
  | 'ENDED';

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

export const startOfLeaseDay = (date: Date) => dayjs.utc(date).startOf('day');

export const isAutoRenewalPeriod = (
  lease: RenewalStateLease,
  today = new Date()
) =>
  lease.autoRenew &&
  lease.status === 'ACTIVE' &&
  startOfLeaseDay(today).isAfter(startOfLeaseDay(lease.endDate), 'day');

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

export const assertExpiredTerminationAllowed = (
  endDate: Date,
  terminatedAt: Date
) => {
  if (startOfLeaseDay(terminatedAt).isBefore(startOfLeaseDay(endDate), 'day')) {
    throw new Error('到期解约的退租日期不能早于原租约结束日期');
  }
};

export const withLeaseLifecycle = <T extends RenewalStateLease>(
  lease: T,
  today = new Date()
) => ({
  ...lease,
  isAutoRenewalPeriod: isAutoRenewalPeriod(lease, today),
});
