import { View, Text } from '@tarojs/components';
import { Icon, type IconName } from './Icon';
import './EmptyState.scss';

export type EmptyStateProps = {
  icon?: IconName;
  emoji?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
};

export function EmptyState({
  icon = 'bill',
  emoji,
  title,
  subtitle,
  action,
}: EmptyStateProps) {
  return (
    <View className="empty-state">
      <View className="empty-state__icon">
        {emoji ? (
          <Text className="empty-state__emoji">{emoji}</Text>
        ) : (
          <Icon name={icon} size="xl" />
        )}
      </View>
      <Text className="empty-state__title">{title}</Text>
      {subtitle && <Text className="empty-state__subtitle">{subtitle}</Text>}
      {action && <View className="empty-state__action">{action}</View>}
    </View>
  );
}
