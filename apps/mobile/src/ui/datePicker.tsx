import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { colors, fontSize, radius, spacing } from './theme';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

const parseDate = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) && dayjs(v).isValid() ? dayjs(v) : null;

/**
 * 日期选择字段：外观与 Field 一致，点击展开月历选择（值为 YYYY-MM-DD 字符串）
 */
export const DatePickerField = ({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) => {
  const selected = parseDate(value);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() =>
    (selected ?? dayjs()).startOf('month')
  );

  const toggle = () => {
    if (!open) setMonth((selected ?? dayjs()).startOf('month'));
    setOpen((v) => !v);
  };

  // 周一开头：dayjs day() 周日=0，换算成「周一=0」的前置空格数
  const leading = (month.day() + 6) % 7;
  const daysInMonth = month.daysInMonth();
  const cells: Array<number | null> = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const today = dayjs().format('YYYY-MM-DD');

  return (
    <View style={{ marginBottom: spacing(3) }}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.input}
        onPress={toggle}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.valueText,
            !selected && { color: colors.textTertiary },
          ]}
        >
          {selected ? value : (placeholder ?? '选择日期')}
        </Text>
        <Ionicons
          name="calendar-outline"
          size={18}
          color={colors.textTertiary}
        />
      </TouchableOpacity>

      {open && (
        <View style={styles.calendar}>
          <View style={styles.calHeader}>
            <TouchableOpacity
              onPress={() => setMonth((m) => m.subtract(1, 'month'))}
              hitSlop={8}
              style={styles.calNav}
            >
              <Ionicons
                name="chevron-back"
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
            <Text style={styles.calTitle}>{month.format('YYYY 年 M 月')}</Text>
            <TouchableOpacity
              onPress={() => setMonth((m) => m.add(1, 'month'))}
              hitSlop={8}
              style={styles.calNav}
            >
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.calRow}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={[styles.calCell, styles.calWeekday]}>
                {w}
              </Text>
            ))}
          </View>

          {Array.from({ length: Math.ceil(cells.length / 7) }, (_, r) => (
            <View key={r} style={styles.calRow}>
              {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
                if (d == null)
                  return <View key={`e${i}`} style={styles.calCell} />;
                const ds = month.date(d).format('YYYY-MM-DD');
                const isSel = ds === value;
                const isToday = ds === today;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.calCell,
                      styles.calDay,
                      isSel && {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                      },
                      !isSel && isToday && { borderColor: colors.primary },
                    ]}
                    onPress={() => {
                      onChange(ds);
                      setOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.calDayText,
                        isSel && { color: '#fff', fontWeight: '700' },
                        !isSel && isToday && { color: colors.primary },
                      ]}
                    >
                      {d}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  valueText: { fontSize: fontSize.md, color: colors.text },
  calendar: {
    marginTop: spacing(2),
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing(2),
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(1),
  },
  calNav: { padding: spacing(1) },
  calTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  calRow: { flexDirection: 'row' },
  calCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calWeekday: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    aspectRatio: undefined,
    paddingVertical: spacing(1),
  },
  calDay: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'transparent',
    margin: 1,
  },
  calDayText: { fontSize: fontSize.sm, color: colors.text },
});
