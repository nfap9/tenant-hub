import { Text, View } from "react-native";
import { colors, spacing, typography } from "../../theme/tokens";
import { Button } from "./Button";

type Props = {
  icon?: string;
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon = "📭", title = "暂无数据", subtitle, actionLabel, onAction }: Props) {
  return (
    <View style={{ alignItems: "center", paddingVertical: spacing[10], gap: spacing[2] }}>
      <Text style={{ fontSize: 40 }}>{icon}</Text>
      <Text style={{ color: colors.text, ...typography.h5, marginTop: spacing[2] }}>{title}</Text>
      {subtitle ? (
        <Text style={{ color: colors.textMuted, ...typography.bodySmall, textAlign: "center", maxWidth: 280 }}>
          {subtitle}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing[2] }}>
          <Button variant="secondary" size="small" onPress={onAction}>
            {actionLabel}
          </Button>
        </View>
      ) : null}
    </View>
  );
}
