import { money, numberValue } from '@/utils/format';
import type { Lease } from '@/types/domain';
import type { LeaseFeeFormItem, TerminationType } from './constants';

export const computeSettlementPreview = (
  lease: Lease,
  terminationForm: {
    rentAdjustmentAmount: string;
    currentWater: string;
    currentPower: string;
    otherFeeAmount: string;
    penaltyAmount: string;
    compensationAmount: string;
  },
  previousReadings: { previousWater: number; previousPower: number }
) => {
  const depositPaid = Number(lease.deposit?.paidAmount ?? 0);
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
  const rentReceivable = Math.max(rentAdjustment, 0);
  const rentRefund = Math.max(-rentAdjustment, 0);
  const receivable =
    rentReceivable + utility + otherFee + penalty + compensation;
  const refundable = depositPaid + rentRefund;
  return {
    utility,
    depositRefund: depositPaid,
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

export const terminationResultText = (net: number) => {
  if (net > 0) return `退租完成，租客应补交 ¥${money(net)}`;
  if (net < 0) return `退租完成，应退租客 ¥${money(Math.abs(net))}`;
  return '退租完成，结算已结清';
};

export const defaultTerminationType = (
  endDate: string,
  todayStr: string
): TerminationType =>
  todayStr > endDate.slice(0, 10) ? 'EXPIRED' : 'NEGOTIATED';
