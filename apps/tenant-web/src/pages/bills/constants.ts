import type { BillCategory, BillStatus } from '@/types/domain';

export const statusLabels: Record<BillStatus, string> = {
  UNPAID: '待支付',
  PAID: '已支付',
  VOID: '已作废',
};

export const toneForBillStatus = (
  status: BillStatus
): 'success' | 'warning' | 'error' | 'default' => {
  if (status === 'PAID') return 'success';
  if (status === 'VOID') return 'error';
  return 'warning';
};

export const billCategoryText: Record<BillCategory, string> = {
  RENT: '租金账单',
  UTILITY: '水电账单',
  DEPOSIT: '押金账单',
  FEE: '费用账单',
  OTHER: '其他账单',
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
