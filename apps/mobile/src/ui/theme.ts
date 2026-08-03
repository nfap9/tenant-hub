/** 设计基调：简洁专业 —— 白底、中性灰、靛蓝主色、卡片式布局 */

export const colors = {
  primary: '#4F46E5',
  primaryLight: '#EEF2FF',
  bg: '#F6F7F9',
  card: '#FFFFFF',
  text: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  border: '#E5E7EB',
  success: '#059669',
  successLight: '#ECFDF5',
  warning: '#D97706',
  warningLight: '#FFFBEB',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  info: '#2563EB',
  infoLight: '#EFF6FF',
};

export const spacing = (n: number) => n * 4;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
};

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
};

/** 状态 → 颜色映射 */
export const statusColor = {
  VACANT: { fg: colors.success, bg: colors.successLight },
  OCCUPIED: { fg: colors.info, bg: colors.infoLight },
  MAINTENANCE: { fg: colors.warning, bg: colors.warningLight },
  SELF_USE: { fg: colors.textSecondary, bg: '#F3F4F6' },
  ACTIVE: { fg: colors.success, bg: colors.successLight },
  TERMINATED: { fg: colors.danger, bg: colors.dangerLight },
  EXPIRED: { fg: colors.warning, bg: colors.warningLight },
  UNPAID: { fg: colors.warning, bg: colors.warningLight },
  PAID: { fg: colors.success, bg: colors.successLight },
  VOID: { fg: colors.textTertiary, bg: '#F3F4F6' },
  PENDING: { fg: colors.info, bg: colors.infoLight },
} as const;
