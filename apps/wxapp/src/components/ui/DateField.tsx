import { useState } from 'react';
import { View, Text, Picker } from '@tarojs/components';
import './DateField.scss';

export type DateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
};

export function DateField({ value, onChange, placeholder = '选择日期', label }: DateFieldProps) {
  const [pickerValue, setPickerValue] = useState(value || '');

  const handleChange = (e: any) => {
    const date = e.detail.value as string;
    setPickerValue(date);
    onChange(date);
  };

  return (
    <View className="date-field-wrapper">
      {label && <Text className="date-field__label">{label}</Text>}
      <Picker mode="date" value={pickerValue} onChange={handleChange}>
        <View className={`date-field ${value ? 'date-field--active' : ''}`}>
          <Text className="date-field__text">{value || placeholder}</Text>
        </View>
      </Picker>
    </View>
  );
}
