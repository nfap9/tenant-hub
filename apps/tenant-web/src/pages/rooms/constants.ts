import type { RoomStatus, RentCycle } from '@/types/domain';

export type { RentCycle };

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

export const selectableFeeTypes: Array<{ type: string; label: string }> = [
  { type: 'MANAGEMENT', label: '管理费' },
  { type: 'SANITATION', label: '卫生费' },
  { type: 'ELEVATOR', label: '电梯费' },
  { type: 'PROPERTY', label: '物业费' },
  { type: 'NETWORK', label: '网费' },
  { type: 'OTHER', label: '其他费用' },
];

export type LeaseFeeFormItem = {
  id: string;
  type: string;
  name: string;
  amount: string;
};

export const emptyRoomForm = {
  roomNo: '',
  floor: undefined as number | undefined,
  layout: '',
  area: '',
  furnishings: [] as string[],
  status: 'VACANT' as RoomStatus,
};

export const emptyLeaseForm = {
  tenantName: '',
  tenantPhone: '',
  startDate: '',
  endDate: '',
  rentCycle: 'MONTHLY' as RentCycle,
  rentAmount: '',
  roomDepositAmount: '',
  keyDepositAmount: '',
};

export const emptyEditLeaseForm = {
  rentAmount: '',
  roomDepositAmount: '',
  keyDepositAmount: '',
};
