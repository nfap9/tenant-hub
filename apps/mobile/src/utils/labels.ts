/** 领域枚举 → 中文标签映射（与 apps/api prisma schema 枚举对应） */

export type RoomStatus = 'VACANT' | 'OCCUPIED' | 'MAINTENANCE' | 'SELF_USE';
export type LeaseStatus = 'DRAFT' | 'ACTIVE' | 'TERMINATED' | 'EXPIRED';
export type BillStatus = 'UNPAID' | 'PAID' | 'VOID' | 'PENDING';
export type BillCategory = 'RENT' | 'UTILITY' | 'DEPOSIT' | 'FEE' | 'OTHER';
export type MeterType = 'WATER' | 'POWER';

export const roomStatusLabel: Record<RoomStatus, string> = {
  VACANT: '空置',
  OCCUPIED: '已租',
  MAINTENANCE: '维护',
  SELF_USE: '自用',
};

export const leaseStatusLabel: Record<LeaseStatus, string> = {
  DRAFT: '草稿',
  ACTIVE: '履约中',
  TERMINATED: '已退租',
  EXPIRED: '已到期',
};

export const billStatusLabel: Record<BillStatus, string> = {
  UNPAID: '待缴',
  PAID: '已缴',
  VOID: '已作废',
  PENDING: '出账中',
};

export const billCategoryLabel: Record<BillCategory, string> = {
  RENT: '房租',
  UTILITY: '水电',
  DEPOSIT: '押金',
  FEE: '附加费',
  OTHER: '其他',
};

export const meterTypeLabel: Record<MeterType, string> = {
  WATER: '水表',
  POWER: '电表',
};

/** 收款方式为后端自由文本，这里提供常用选项（与 tenant-web 收款弹窗一致） */
export const paymentMethodOptions = [
  '线下收款',
  '现金',
  '微信',
  '支付宝',
  '银行转账',
];
