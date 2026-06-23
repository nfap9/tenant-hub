import type {
  RoomStatus,
  RentCycle,
  BillItemType,
  TerminationType,
} from '@/types/domain';

export type { RentCycle, TerminationType };

export const statusLabels: Record<RoomStatus, string> = {
  VACANT: '空闲',
  RESERVED: '预留',
  OCCUPIED: '已租',
  MAINTENANCE: '维修',
  SELF_USE: '自用',
};

export const toneForStatus: Record<
  RoomStatus,
  'success' | 'neutral' | 'warning' | 'danger' | 'primary'
> = {
  VACANT: 'success',
  RESERVED: 'neutral',
  OCCUPIED: 'warning',
  MAINTENANCE: 'danger',
  SELF_USE: 'primary',
};

export const filters: Array<RoomStatus | 'ALL'> = [
  'ALL',
  'VACANT',
  'OCCUPIED',
  'RESERVED',
  'MAINTENANCE',
  'SELF_USE',
];

export const roomStatuses: RoomStatus[] = [
  'VACANT',
  'RESERVED',
  'OCCUPIED',
  'MAINTENANCE',
  'SELF_USE',
];

export const cycleLabels: Record<RentCycle, string> = {
  MONTHLY: '月付',
  QUARTERLY: '季付',
  YEARLY: '年付',
};

export const selectableFeeTypes: Array<{ type: BillItemType; label: string }> =
  [
    { type: 'MANAGEMENT', label: '管理费' },
    { type: 'SANITATION', label: '卫生费' },
    { type: 'ELEVATOR', label: '电梯费' },
    { type: 'PROPERTY', label: '物业费' },
    { type: 'NETWORK', label: '网费' },
    { type: 'OTHER', label: '其他费用' },
  ];

export const terminationLabels: Record<TerminationType, string> = {
  EXPIRED: '到期解约',
  NEGOTIATED: '协商解约',
  BREACH: '违约退租',
};

export type LeaseFeeFormItem = {
  id: string;
  type: BillItemType;
  name: string;
  amount: string;
};

export const emptyRoomForm = {
  roomNo: '',
  layout: '',
  area: '',
  facilities: [] as string[],
  status: 'VACANT' as RoomStatus,
};

export const emptyLeaseForm = {
  tenantName: '',
  tenantPhone: '',
  startDate: '',
  endDate: '',
  cycle: 'MONTHLY' as RentCycle,
  rentAmount: '',
  roomDepositAmount: '',
  keyQuantity: 0,
  keyUnitPrice: '',
  waterUnitPrice: '0',
  powerUnitPrice: '0',
  autoRenew: true,
  historicalBills: [] as {
    billingDate: string;
    currentWater: number;
    currentPower: number;
    settled: boolean;
  }[],
  historicalBaseWater: 0,
  historicalBasePower: 0,
  depositSettled: false,
};

export const emptyEditLeaseForm = {
  rentAmount: '',
  roomDepositAmount: '',
  keyQuantity: 0,
  keyUnitPrice: '',
  waterUnitPrice: '0',
  powerUnitPrice: '0',
};

export const emptyTerminationForm = {
  type: 'NEGOTIATED' as TerminationType,
  terminatedAt: '',
  reason: '',
  rentAdjustmentAmount: '0',
  currentWater: '0',
  currentPower: '0',
  otherFeeAmount: '0',
  otherFeeReason: '',
  roomDepositRefundAmount: '0',
  keyDepositRefundAmount: '0',
  roomDepositDeductionAmount: '0',
  keyDepositDeductionAmount: '0',
  depositDeductionReason: '',
};
