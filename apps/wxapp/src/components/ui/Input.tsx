import { View, Input as TaroInput, Text } from '@tarojs/components';
import './Input.scss';

export type InputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  type?: 'text' | 'number' | 'digit' | 'idcard';
  password?: boolean;
  error?: string;
};

export function Input({
  value,
  onChange,
  placeholder,
  label,
  type = 'text',
  password,
  error
}: InputProps) {
  return (
    <View className={`input-wrapper ${error ? 'input-wrapper--error' : ''}`}>
      {label && <Text className="input__label">{label}</Text>}
      <TaroInput
        className="input"
        value={value}
        placeholder={placeholder}
        type={type}
        password={password}
        onInput={(e) => onChange(e.detail.value)}
      />
      {error && <Text className="input__error">{error}</Text>}
    </View>
  );
}
