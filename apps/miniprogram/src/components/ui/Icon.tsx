import { Text } from '@tarojs/components';
import './Icon.scss';

export type IconName =
  | 'apartment'
  | 'bill'
  | 'check'
  | 'contract'
  | 'meter'
  | 'payment'
  | 'plan'
  | 'room';

export type IconProps = {
  name: IconName;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  tone?: 'primary' | 'muted' | 'success' | 'warning' | 'danger' | 'inherit';
  className?: string;
};

const iconCodepoints: Record<IconName, number> = {
  room: 0xf101,
  plan: 0xf102,
  payment: 0xf103,
  meter: 0xf104,
  contract: 0xf105,
  check: 0xf106,
  bill: 0xf107,
  apartment: 0xf108,
};

export function Icon({
  name,
  size = 'md',
  tone = 'primary',
  className = '',
}: IconProps) {
  return (
    <Text className={`icon icon--${size} icon--${tone} ${className}`}>
      {String.fromCharCode(iconCodepoints[name])}
    </Text>
  );
}
