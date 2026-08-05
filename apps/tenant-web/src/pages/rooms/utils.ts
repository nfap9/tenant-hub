import dayjs from 'dayjs';
import type { Lease, Deposit } from '@/types/domain';
import type { LeaseFeeFormItem, RentCycle } from './constants';

const cycleMonths: Record<RentCycle, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  YEARLY: 12,
};

export const getHistoricalBillingDates = (
  startDate: string,
  endDate: string,
  rentCycle: RentCycle
): string[] => {
  const months = cycleMonths[rentCycle];
  const today = dayjs().startOf('day');
  const leaseEnd = dayjs(endDate).startOf('day');
  const limit = today.isBefore(leaseEnd) ? today : leaseEnd;
  const dates: string[] = [];
  let cursor = dayjs(startDate).startOf('day');

  while (cursor.isBefore(limit) || cursor.isSame(limit, 'day')) {
    dates.push(cursor.format('YYYY-MM-DD'));
    cursor = cursor.add(months, 'month');
  }

  dates.pop();
  return dates;
};

export const formatHistoricalBillPeriodLabel = (
  billingDate: string,
  rentCycle: RentCycle
): string => {
  const months = cycleMonths[rentCycle];
  const start = dayjs(billingDate);
  const end = start.add(months, 'month').subtract(1, 'day');
  return `${start.format('YYYY-MM-DD')} ~ ${end.format('YYYY-MM-DD')}`;
};

export const getRoomDeposit = (lease?: Lease): Deposit | undefined =>
  lease?.deposits?.find((d) => d.type === 'ROOM');

export const getKeyDeposit = (lease?: Lease): Deposit | undefined =>
  lease?.deposits?.find((d) => d.type === 'KEY');

export const getTotalDepositPaid = (lease?: Lease): number => {
  if (!lease?.deposits) return 0;
  return lease.deposits.reduce((sum, d) => sum + Number(d.paidAmount ?? 0), 0);
};

export const buildLeaseFeesPayload = (fees: LeaseFeeFormItem[]) =>
  fees
    .filter((item) => item.name.trim() && item.amount.trim())
    .map((item) => ({
      type: item.type,
      name: item.name.trim(),
      amount: Number(item.amount),
    }));
