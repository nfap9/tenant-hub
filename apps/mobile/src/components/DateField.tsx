import { useMemo, useState } from "react";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Modal, Platform, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { PressableScale } from "./ui/PressableScale";
import { styles } from "../theme/styles";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
};

const toDate = (value: string) => {
  const date = value ? new Date(`${value.slice(0, 10)}T00:00:00`) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const toDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const sameDate = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();

const monthTitle = (date: Date) => `${date.getFullYear()}年${date.getMonth() + 1}月`;

const monthDays = (month: Date) => {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return [
    ...Array.from({ length: firstDay.getDay() }, () => undefined),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1))
  ];
};

export function DateField({ value, onChange, placeholder = "选择日期", style }: Props) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => toDate(value));
  const selectedDate = toDate(value);
  const days = useMemo(() => monthDays(visibleMonth), [visibleMonth]);

  const openPicker = () => {
    setVisibleMonth(toDate(value));
    setOpen((current) => !current);
  };

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") setOpen(false);
    if (event.type === "dismissed" || !selectedDate) return;
    onChange(toDateString(selectedDate));
  };

  if (Platform.OS === "web") {
    return (
      <View style={[styles.dateFieldWrap, style]}>
        <PressableScale scale={0.98} style={[styles.input, styles.dateField]} onPress={openPicker}>
          <Text style={value ? styles.dateFieldText : styles.dateFieldPlaceholder}>{value || placeholder}</Text>
        </PressableScale>
        {open ? (
          <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
            <PressableScale style={styles.datePickerModalOverlay} onPress={() => setOpen(false)}>
              <View style={styles.datePickerModalPanel}>
                <View style={styles.datePickerHeader}>
                  <PressableScale scale={0.9} style={styles.datePickerNav} onPress={() => setVisibleMonth((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))}>
                    <Text style={styles.datePickerNavText}>‹</Text>
                  </PressableScale>
                  <Text style={styles.datePickerTitle}>{monthTitle(visibleMonth)}</Text>
                  <PressableScale scale={0.9} style={styles.datePickerNav} onPress={() => setVisibleMonth((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))}>
                    <Text style={styles.datePickerNavText}>›</Text>
                  </PressableScale>
                </View>
                <View style={styles.datePickerGrid}>
                  {["日", "一", "二", "三", "四", "五", "六"].map((item) => (
                    <Text key={item} style={styles.datePickerWeekday}>{item}</Text>
                  ))}
                  {days.map((day, index) => (
                    <PressableScale
                      key={day ? toDateString(day) : `blank-${index}`}
                      scale={0.9}
                      disabled={!day}
                      onPress={() => {
                        if (!day) return;
                        onChange(toDateString(day));
                        setOpen(false);
                      }}
                    >
                      <View style={[styles.datePickerDay, day && sameDate(day, selectedDate) && styles.datePickerDayActive]}>
                        <Text style={[styles.datePickerDayText, day && sameDate(day, selectedDate) && styles.datePickerDayTextActive]}>{day?.getDate() ?? ""}</Text>
                      </View>
                    </PressableScale>
                  ))}
                </View>
              </View>
            </PressableScale>
          </Modal>
        ) : null}
      </View>
    );
  }

  return (
    <>
      <PressableScale scale={0.98} style={[styles.input, styles.dateField, style]} onPress={() => setOpen(true)}>
        <Text style={value ? styles.dateFieldText : styles.dateFieldPlaceholder}>{value || placeholder}</Text>
      </PressableScale>
      {open ? (
        <DateTimePicker
          value={toDate(value)}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={handleChange}
        />
      ) : null}
    </>
  );
}
