import type { BillStatus } from '@/types/domain';

export const statusLabels: Record<BillStatus, string> = {
  DRAFT: '草稿',
  BILLING: '出账中',
  UNPAID: '待支付',
  PARTIAL_PAID: '部分支付',
  PAID: '已支付',
  OVERDUE: '逾期',
  WRITTEN_OFF: '已核销',
  FAILED: '出账失败',
  VOID: '已作废',
  REFUNDED: '已退款',
};

export const toneForBillStatus = (
  status: BillStatus
): 'success' | 'warning' | 'error' | 'default' => {
  if (status === 'PAID') return 'success';
  if (status === 'FAILED' || status === 'VOID') return 'error';
  if (status === 'OVERDUE') return 'error';
  if (status === 'BILLING') return 'default';
  return 'warning';
};

export const billModeText = (mode: string) => {
  if (mode === 'PREPAID') return '预付';
  if (mode === 'POSTPAID') return '后付';
  if (mode === 'DEPOSIT') return '押金';
  return mode;
};

export const billTypeText = (type: string) => {
  const map: Record<string, string> = {
    MONTHLY: '月度账单',
    SETTLEMENT: '退租账单',
    DEPOSIT: '押金账单',
  };
  return map[type] || type;
};

export const billTypeTone = (type: string): string => {
  if (type === 'MONTHLY') return 'blue';
  if (type === 'SETTLEMENT') return 'orange';
  if (type === 'DEPOSIT') return 'purple';
  return 'default';
};

export const billItemTypeText = (type: string) => {
  const map: Record<string, string> = {
    RENT: '房租',
    SERVICE_FEE: '服务费',
    UTILITY: '水电费',
    ELECTRICITY: '电费',
    WATER: '水费',
    POWER: '电费',
    GAS: '燃气费',
    CARRY_OVER: '结转',
    LATE_FEE: '滞纳金',
    DEPOSIT: '押金',
    MANAGEMENT: '管理费',
    SANITATION: '卫生费',
    ELEVATOR: '电梯费',
    PROPERTY: '物业费',
    NETWORK: '网费',
    PENALTY: '违约金',
    COMPENSATION: '赔偿金',
    CLEANING_FEE: '清洁费',
    PREPAID_DEDUCTION: '预付抵扣',
    DISCOUNT: '优惠',
    OTHER: '其他',
  };
  return map[type] || type;
};
