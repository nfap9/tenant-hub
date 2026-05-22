import { View, Text } from '@tarojs/components';
import './Button.scss';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'default' | 'small';

export type ButtonProps = {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
};

export function Button({
  children,
  variant = 'primary',
  size = 'default',
  disabled,
  loading,
  onClick,
  className = '',
}: ButtonProps) {
  const baseClass = `btn btn--${variant} btn--${size}`;
  const stateClass = `${disabled ? ' btn--disabled' : ''}${loading ? ' btn--loading' : ''}`;

  return (
    <View
      className={`${baseClass}${stateClass} ${className}`}
      onClick={!disabled && !loading ? onClick : undefined}
    >
      <Text className="btn__text">{loading ? '加载中...' : children}</Text>
    </View>
  );
}
