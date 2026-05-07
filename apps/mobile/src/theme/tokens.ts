import { Platform } from "react-native";

// ============================================
// Colors — 清爽风格配色 Token
// ============================================
export const colors = {
  // Brand — 清爽蓝绿
  primary: "#0d9488",
  primaryDark: "#115e59",
  primaryLight: "#ccfbf1",
  primaryLighter: "#e6fffa",
  primaryLightest: "#f0fdfa",

  // Accent
  accent: "#f59e0b",
  accentLight: "#e0f2fe",

  // Backgrounds — 冷白灰系
  background: "#f8fafc",
  surface: "#ffffff",
  surfaceWarm: "#fafaf9",
  surfaceWarm2: "#fafafa",

  // Text — 深灰蓝
  text: "#0f172a",
  textSecondary: "#334155",
  textMuted: "#64748b",
  textPlaceholder: "#94a3b8",

  // Borders — 浅灰蓝
  border: "#e2e8f0",
  borderLight: "#f1f5f9",
  borderLighter: "#f8fafc",

  // Dividers
  divider: "#e2e8f0",
  dividerLight: "#f1f5f9",

  // Status
  success: "#0d9488",
  successLight: "#ccfbf1",
  warning: "#d97706",
  warningLight: "#fffbeb",
  danger: "#dc2626",
  dangerLight: "#fef2f2",
  neutral: "#64748b",
  neutralLight: "#f1f5f9",

  // Overlays
  overlay: "rgba(15, 23, 42, 0.28)",
  overlayHeavy: "rgba(15, 23, 42, 0.42)",
  toastBg: "rgba(15, 23, 42, 0.92)",

  // Misc
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent"
} as const;

// ============================================
// Spacing — 4px base grid
// ============================================
export const spacing = {
  "0": 0,
  "0.5": 2,
  "0.75": 3,
  "1": 4,
  "1.5": 6,
  "2": 8,
  "2.5": 10,
  "3": 12,
  "3.5": 14,
  "4": 16,
  "4.5": 18,
  "5": 20,
  "6": 24,
  "7": 28,
  "8": 32,
  "10": 40,
  "12": 48,
  "16": 64,
  "20": 80,
  "24": 96
} as const;

// ============================================
// Radii — 圆角系统
// ============================================
export const radii = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 20,
  full: 999
} as const;

// ============================================
// Shadows — 统一阴影层级
// ============================================
export const shadows = {
  none: {} as const,

  subtle: {
    shadowColor: colors.black,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },

  card: {
    shadowColor: colors.black,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4
  },

  elevated: {
    shadowColor: colors.black,
    shadowOpacity: 0.10,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8
  },

  float: {
    shadowColor: colors.black,
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12
  }
} as const;

// ============================================
// Typography — 字号与字重
// ============================================
export const typography = {
  hero: { fontSize: 34, lineHeight: 40, fontWeight: "700" as const },
  h1: { fontSize: 30, lineHeight: 36, fontWeight: "700" as const },
  h2: { fontSize: 24, lineHeight: 30, fontWeight: "700" as const },
  h3: { fontSize: 21, lineHeight: 26, fontWeight: "700" as const },
  h4: { fontSize: 18, lineHeight: 24, fontWeight: "700" as const },
  h5: { fontSize: 17, lineHeight: 22, fontWeight: "700" as const },
  h6: { fontSize: 16, lineHeight: 22, fontWeight: "700" as const },

  bodyLarge: { fontSize: 15, lineHeight: 21, fontWeight: "400" as const },
  body: { fontSize: 14, lineHeight: 19, fontWeight: "400" as const },
  bodySmall: { fontSize: 13, lineHeight: 18, fontWeight: "400" as const },

  label: { fontSize: 13, lineHeight: 18, fontWeight: "700" as const },
  labelSmall: { fontSize: 12, lineHeight: 16, fontWeight: "700" as const },
  caption: { fontSize: 11, lineHeight: 15, fontWeight: "400" as const },

  // Numeric / data
  stat: { fontSize: 20, lineHeight: 26, fontWeight: "700" as const },
  metric: { fontSize: 24, lineHeight: 30, fontWeight: "700" as const }
} as const;

// ============================================
// Layout constants
// ============================================
export const layout = {
  tabBarBottomOffset: Platform.OS === "ios" ? 14 : 0,
  tabBarHeight: 64,
  headerHeight: 56,
  contentBottomPadding: 92 + (Platform.OS === "ios" ? 14 : 0),
  maxModalWidth: 320,
  maxSheetHeight: "90%" as const,
  minSheetHeight: "62%" as const
} as const;

// ============================================
// Helper: tone → color mapping for Badge / status
// ============================================
export type Tone = "success" | "warning" | "danger" | "neutral" | "primary";

export function toneColors(tone: Tone) {
  const map: Record<Tone, { bg: string; text: string }> = {
    success: { bg: colors.successLight, text: colors.success },
    warning: { bg: colors.warningLight, text: colors.warning },
    danger: { bg: colors.dangerLight, text: colors.danger },
    neutral: { bg: colors.neutralLight, text: colors.neutral },
    primary: { bg: colors.primaryLightest, text: colors.primary }
  };
  return map[tone];
}

// ============================================
// Helper: press color darken (for press feedback)
// ============================================
export function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) - amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) - amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000ff) - amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
