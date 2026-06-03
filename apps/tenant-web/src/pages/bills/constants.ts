import type { BillStatus } from '@/types/domain';

export const statusLabels: Record<BillStatus, string> = {
  DRAFT: '草稿',
  BILLING: '出账中',
  UNPAID: '待支付',
  PARTIAL_PAID: '部分支付',
  PAID: '已支付',
  FAILED: '出账失败',
  VOID: '已作废',
  REFUNDED: '已退款',
};

export const toneForBillStatus = (
  status: BillStatus
): 'success' | 'warning' | 'error' | 'default' => {
  if (status === 'PAID') return 'success';
  if (status === 'FAILED' || status === 'VOID') return 'error';
  if (status === 'REFUNDED') return 'default';
  if (status === 'BILLING') return 'default';
  return 'warning';
};

export const billModeText = (mode: string) => {
  if (mode === 'PREPAID') return '预付';
  if (mode === 'POSTPAID') return '后付';
  if (mode === 'DEPOSIT') return '押金';
  return mode;
};

export const billItemTypeText = (type: string) => {
  const map: Record<string, string> = {
    RENT: '房租',
    UTILITY: '水电费',
    WATER: '水费',
    POWER: '电费',
    DEPOSIT: '押金',
    MANAGEMENT: '管理费',
    SANITATION: '卫生费',
    ELEVATOR: '电梯费',
    PROPERTY: '物业费',
    NETWORK: '网费',
    OTHER: '其他',
  };
  return map[type] || type;
};
