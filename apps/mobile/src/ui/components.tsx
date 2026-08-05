import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, radius, spacing } from './theme';

export const Card = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) => <View style={[styles.card, style]}>{children}</View>;

export const Badge = ({
  label,
  fg,
  bg,
}: {
  label: string;
  fg: string;
  bg: string;
}) => (
  <View style={[styles.badge, { backgroundColor: bg }]}>
    <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
  </View>
);

export const Button = ({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) => {
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.danger
        : 'transparent';
  const fg =
    variant === 'primary' || variant === 'danger'
      ? '#fff'
      : variant === 'outline'
        ? colors.primary
        : colors.textSecondary;
  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: bg },
        variant === 'outline' && {
          borderWidth: 1,
          borderColor: colors.primary,
        },
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

export const Field = ({
  label,
  secureToggle,
  ...props
}: { label: string; secureToggle?: boolean } & TextInputProps) => {
  // secureToggle：默认隐藏内容（圆点），点眼睛图标切换明文显示
  const [hidden, setHidden] = useState(true);
  return (
    <View style={{ marginBottom: spacing(3) }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {secureToggle ? (
        <View style={styles.secureWrap}>
          <TextInput
            style={[styles.input, styles.secureInput]}
            placeholderTextColor={colors.textTertiary}
            secureTextEntry={hidden}
            {...props}
          />
          <TouchableOpacity
            onPress={() => setHidden((v) => !v)}
            style={styles.eyeBtn}
          >
            <Ionicons
              name={hidden ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        </View>
      ) : (
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.textTertiary}
          {...props}
        />
      )}
    </View>
  );
};

export const SectionHeader = ({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {right}
  </View>
);

export const EmptyState = ({ text, hint }: { text: string; hint?: string }) => (
  <View style={styles.empty}>
    <Text style={styles.emptyText}>{text}</Text>
    {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
  </View>
);

export const Row = ({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, valueColor ? { color: valueColor } : null]}>
      {value}
    </Text>
  </View>
);

export const Chip = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) => (
  <TouchableOpacity
    style={[
      styles.chip,
      active && {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
      },
    ]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing(4),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  badge: {
    paddingHorizontal: spacing(2),
    paddingVertical: 2,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: fontSize.xs, fontWeight: '600' },
  button: {
    borderRadius: radius.sm,
    paddingVertical: spacing(3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: fontSize.md, fontWeight: '600' },
  fieldLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing(1.5),
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: fontSize.md,
    color: colors.text,
  },
  secureWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  secureInput: { flex: 1, borderWidth: 0 },
  eyeBtn: { paddingHorizontal: spacing(3) },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing(2),
    marginTop: spacing(2),
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  empty: { alignItems: 'center', paddingVertical: spacing(12) },
  emptyText: { fontSize: fontSize.md, color: colors.textTertiary },
  emptyHint: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing(1),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing(1.5),
  },
  rowLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  rowValue: { fontSize: fontSize.sm, color: colors.text, fontWeight: '500' },
  chip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: spacing(2),
  },
  chipText: { fontSize: fontSize.sm, color: colors.textSecondary },
});
