import { View, Text } from '@tarojs/components';
import './Badge.scss';

export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'primary';

export type BadgeProps = {
  children: React.ReactNode;
  tone?: Tone;
};

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return (
    <View className={`badge badge--${tone}`}>
      <Text>{children}</Text>
    </View>
  );
}
