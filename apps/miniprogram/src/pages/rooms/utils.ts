import { money, numberValue } from '../../utils/format';
import type { Lease } from '../../types/domain';
import type { LeaseFeeFormItem, TerminationType } from './constants';

export const computeSettlementPreview = (
  lease: Lease,
  terminationForm: {
    roomDepositRefundAmount: string;
    keyDepositRefundAmount: string;
    roomDepositDeductionAmount: string;
    keyDepositDeductionAmount: string;
    rentAdjustmentAmount: string;
    currentWater: string;
    currentPower: string;
    otherFeeAmount: string;
  },
  previousReadings: { previousWater: number; previousPower: number }
) => {
  const roomDepositPaid = Number(
    lease.deposits?.find((d) => d.type === 'ROOM')?.paidAmount ?? 0
  );
  const keyDepositPaid = Number(
    lease.deposits?.find((d) => d.type === 'KEY')?.paidAmount ?? 0
  );
  const totalDepositPaid = roomDepositPaid + keyDepositPaid;

  const roomDepositDeduction = numberValue(
    terminationForm.roomDepositDeductionAmount
  );
  const keyDepositDeduction = numberValue(
    terminationForm.keyDepositDeductionAmount
  );
  const totalDepositDeduction = roomDepositDeduction + keyDepositDeduction;

  const roomDepositRefund = Math.min(
    numberValue(terminationForm.roomDepositRefundAmount),
    Math.max(roomDepositPaid - roomDepositDeduction, 0)
  );
  const keyDepositRefund = Math.min(
    numberValue(terminationForm.keyDepositRefundAmount),
    Math.max(keyDepositPaid - keyDepositDeduction, 0)
  );
  const totalDepositRefund = roomDepositRefund + keyDepositRefund;

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

  const receivable =
    Math.max(rentAdjustment, 0) + utility + otherFee + totalDepositDeduction;
  const refundable = totalDepositRefund + Math.max(-rentAdjustment, 0);
  return {
    utility,
    depositRefund: totalDepositRefund,
    roomDepositRefund,
    keyDepositRefund,
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
