import type { ReactNode } from "react";
import { Text, View, type ViewStyle } from "react-native";
import { colors, radii, shadows, spacing, typography } from "../../theme/tokens";
import { PressableScale } from "./PressableScale";

type CardVariant = "default" | "warm" | "outline";

type Props = {
  children?: ReactNode;
  variant?: CardVariant;
  padding?: "none" | "sm" | "md" | "lg";
  gap?: number;
  title?: string;
  subtitle?: string;
  headerAction?: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
};

const paddingMap = {
  none: 0,
  sm: spacing[3],
  md: spacing[3.5],
  lg: spacing[4]
};

export function Card({
  children,
  variant = "default",
  padding = "md",
  gap = spacing[2.5],
  title,
  subtitle,
  headerAction,
  style,
  onPress
}: Props) {
  const bgColors: Record<CardVariant, string> = {
    default: colors.surface,
    warm: colors.surfaceWarm2,
    outline: colors.surface
  };

  const borderColors: Record<CardVariant, string> = {
    default: colors.transparent,
    warm: colors.borderLight,
    outline: colors.borderLight
  };

  const content = (
    <View
      style={[
        {
          backgroundColor: bgColors[variant],
          borderRadius: radii.lg,
          padding: paddingMap[padding],
          gap,
          borderWidth: variant === "outline" || variant === "warm" ? 1 : 0,
          borderColor: borderColors[variant],
          ...shadows.card
        },
        style
      ]}
    >
      {(title || headerAction) ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing[3] }}>
          <View style={{ flex: 1, gap: spacing[0.5] }}>
            {title ? <Text style={{ color: colors.text, ...typography.h5 }}>{title}</Text> : null}
            {subtitle ? <Text style={{ color: colors.textMuted, ...typography.bodySmall }}>{subtitle}</Text> : null}
          </View>
          {headerAction ? <View>{headerAction}</View> : null}
        </View>
      ) : null}
      {children}
    </View>
  );

  if (onPress) {
    return <PressableScale onPress={onPress}>{content}</PressableScale>;
  }

  return content;
}
