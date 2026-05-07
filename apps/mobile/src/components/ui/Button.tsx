import { Text, View, type ViewStyle } from "react-native";
import { colors, darken, radii, spacing, typography } from "../../theme/tokens";
import { PressableScale } from "./PressableScale";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "default" | "small";

type Props = {
  children: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

export function Button({
  children,
  variant = "primary",
  size = "default",
  disabled = false,
  loading = false,
  fullWidth = false,
  onPress,
  style
}: Props) {
  const isSmall = size === "small";
  const isDisabled = disabled || loading;

  const variantStyles: Record<ButtonVariant, { bg: string; bgPressed: string; text: string; border: string }> = {
    primary: {
      bg: colors.primary,
      bgPressed: darken(colors.primary, 20),
      text: colors.white,
      border: colors.transparent
    },
    secondary: {
      bg: colors.transparent,
      bgPressed: colors.primaryLightest,
      text: colors.primary,
      border: colors.primary
    },
    ghost: {
      bg: colors.transparent,
      bgPressed: "rgba(0,0,0,0.04)",
      text: colors.textSecondary,
      border: colors.border
    },
    danger: {
      bg: colors.transparent,
      bgPressed: colors.dangerLight,
      text: colors.danger,
      border: colors.danger
    }
  };

  const vs = variantStyles[variant];

  const baseHeight = isSmall ? 34 : 44;
  const horizontalPadding = isSmall ? spacing[2.5] : spacing[4];

  return (
    <PressableScale
      onPress={onPress}
      disabled={isDisabled}
      style={[
        {
          minHeight: baseHeight,
          paddingHorizontal: horizontalPadding,
          borderRadius: radii.md,
          backgroundColor: isDisabled ? colors.borderLight : vs.bg,
          borderWidth: 1,
          borderColor: isDisabled ? colors.border : vs.border,
          alignItems: "center",
          justifyContent: "center",
          opacity: isDisabled ? 0.5 : 1,
          flex: fullWidth ? 1 : undefined
        },
        style
      ]}
    >
      <Text
        style={{
          color: isDisabled ? colors.textMuted : vs.text,
          fontWeight: "700",
          fontSize: isSmall ? 13 : 14
        }}
      >
        {loading ? "处理中..." : children}
      </Text>
    </PressableScale>
  );
}
