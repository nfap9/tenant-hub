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
};

export const toneForStatus: Record<
  RoomStatus,
  'success' | 'neutral' | 'warning' | 'danger'
> = {
  VACANT: 'success',
  RESERVED: 'neutral',
  OCCUPIED: 'warning',
  MAINTENANCE: 'danger',
};

export const filters: Array<RoomStatus | 'ALL'> = [
  'ALL',
  'VACANT',
  'OCCUPIED',
  'RESERVED',
  'MAINTENANCE',
];

export const roomStatuses: RoomStatus[] = [
  'VACANT',
  'RESERVED',
  'OCCUPIED',
  'MAINTENANCE',
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

export const feeTypeLabels = selectableFeeTypes.reduce(
  (labels, item) => ({ ...labels, [item.type]: item.label }),
  {} as Partial<Record<BillItemType, string>>
);

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

export const orientationOptions = [
  { label: '北', value: 'NORTH' },
  { label: '南', value: 'SOUTH' },
  { label: '东', value: 'EAST' },
  { label: '西', value: 'WEST' },
  { label: '东北', value: 'NORTH_EAST' },
  { label: '西北', value: 'NORTH_WEST' },
  { label: '东南', value: 'SOUTH_EAST' },
  { label: '西南', value: 'SOUTH_WEST' },
];

export const decorationStatusOptions = [
  { label: '毛坯', value: 'BARE' },
  { label: '简装', value: 'SIMPLE' },
  { label: '精装', value: 'DELUXE' },
  { label: '豪华装', value: 'LUXURY' },
];

export const emptyRoomForm = {
  roomNo: '',
  layout: '',
  area: '',
  facilities: '',
  status: 'VACANT' as RoomStatus,
};

export const emptyLeaseForm = {
  tenantName: '',
  tenantPhone: '',
  startDate: '',
  endDate: '',
  graceDays: '0',
  cycle: 'MONTHLY' as RentCycle,
  rentAmount: '',
  depositAmount: '',
  waterUnitPrice: '0',
  powerUnitPrice: '0',
  autoRenew: true,
  generateHistoricalBills: false,
};

export const emptyEditLeaseForm = {
  rentAmount: '',
  depositAmount: '',
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
};
