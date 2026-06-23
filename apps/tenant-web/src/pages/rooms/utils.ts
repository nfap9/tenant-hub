import dayjs from 'dayjs';
import { numberValue } from '@/utils/format';
import type { Lease, Deposit } from '@/types/domain';
import type { LeaseFeeFormItem, TerminationType, RentCycle } from './constants';

const cycleMonths: Record<RentCycle, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  YEARLY: 12,
};

export const getHistoricalBillingDates = (
  startDate: string,
  endDate: string,
  cycle: RentCycle,
  autoRenew = false
): string[] => {
  const months = cycleMonths[cycle];
  const today = dayjs().startOf('day');
  const leaseEnd = dayjs(endDate).startOf('day');
  const limit = autoRenew ? today : today.isBefore(leaseEnd) ? today : leaseEnd;
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
  cycle: RentCycle
): string => {
  const months = cycleMonths[cycle];
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

export const computeSettlementPreview = (
  lease: Lease,
  terminationForm: {
    rentAdjustmentAmount: string;
    currentWater: string;
    currentPower: string;
    otherFeeAmount: string;
    penaltyAmount: string;
    compensationAmount: string;
    roomDepositRefundAmount?: string;
    keyDepositRefundAmount?: string;
    roomDepositDeductionAmount?: string;
    keyDepositDeductionAmount?: string;
  },
  previousReadings: { previousWater: number; previousPower: number }
) => {
  const roomDeposit = getRoomDeposit(lease);
  const keyDeposit = getKeyDeposit(lease);

  const roomDepositPaid = Number(roomDeposit?.paidAmount ?? 0);
  const keyDepositPaid = Number(keyDeposit?.paidAmount ?? 0);

  const roomRefund = Math.min(
    numberValue(terminationForm.roomDepositRefundAmount ?? roomDepositPaid),
    roomDepositPaid
  );
  const keyRefund = Math.min(
    numberValue(terminationForm.keyDepositRefundAmount ?? keyDepositPaid),
    keyDepositPaid
  );
  const roomDeduction = numberValue(
    terminationForm.roomDepositDeductionAmount ?? 0
  );
  const keyDeduction = numberValue(
    terminationForm.keyDepositDeductionAmount ?? 0
  );

  const depositRefund = roomRefund + keyRefund;
  const depositDeduction = roomDeduction + keyDeduction;

  const rentAdjustment = numberValue(terminationForm.rentAdjustmentAmount);
  const water =
    Math.max(
      numberValue(terminationForm.currentWater) -
        previousReadings.previousWater,
      0
    ) * Number(lease.waterUnitPrice ?? 0);
  const power =
    Math.max(
      numberValue(terminationForm.currentPower) -
        previousReadings.previousPower,
      0
    ) * Number(lease.powerUnitPrice ?? 0);
  const utility = water + power;
  const otherFee = numberValue(terminationForm.otherFeeAmount);
  const penalty = numberValue(terminationForm.penaltyAmount);
  const compensation = numberValue(terminationForm.compensationAmount);

  const receivable =
    Math.max(rentAdjustment, 0) +
    utility +
    otherFee +
    penalty +
    compensation +
    depositDeduction;
  const refundable = depositRefund + Math.max(-rentAdjustment, 0);

  return {
    utility,
    depositRefund,
    depositDeduction,
    receivable,
    refundable,
    net: receivable - refundable,
  };
};

export const buildLeaseFeesPayload = (fees: LeaseFeeFormItem[]) =>
  fees
    .filter((item) => item.name.trim() && item.amount.trim())
    .map((item) => ({
      type: item.type,
      name: item.name.trim(),
      amount: Number(item.amount),
    }));

export const defaultTerminationType = (
  endDate: string,
  todayStr: string
): TerminationType =>
  todayStr > endDate.slice(0, 10) ? 'EXPIRED' : 'NEGOTIATED';
