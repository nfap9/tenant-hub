import { View, Text } from '@tarojs/components';
import './EmptyState.scss';

export type EmptyStateProps = {
  emoji?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
};

export function EmptyState({ emoji = '📭', title, subtitle, action }: EmptyStateProps) {
  return (
    <View className="empty-state">
      <Text className="empty-state__emoji">{emoji}</Text>
      <Text className="empty-state__title">{title}</Text>
      {subtitle && <Text className="empty-state__subtitle">{subtitle}</Text>}
      {action && <View className="empty-state__action">{action}</View>}
    </View>
  );
}
