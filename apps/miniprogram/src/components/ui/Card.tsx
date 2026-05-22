import { View, Text } from '@tarojs/components';
import './Card.scss';

export type CardVariant = 'default' | 'warm' | 'outline';

export type CardProps = {
  children: React.ReactNode;
  variant?: CardVariant;
  padding?: 'sm' | 'md' | 'lg';
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  onClick?: () => void;
  className?: string;
};

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  title,
  subtitle,
  headerAction,
  onClick,
  className = '',
}: CardProps) {
  const base = `card card--${variant} card--padding-${padding}`;
  return (
    <View className={`${base} ${className}`} onClick={onClick}>
      {(title || headerAction) && (
        <View className="card__header">
          <View className="card__title-block">
            {title && <Text className="card__title">{title}</Text>}
            {subtitle && <Text className="card__subtitle">{subtitle}</Text>}
          </View>
          {headerAction && <View>{headerAction}</View>}
        </View>
      )}
      <View className="card__body">{children}</View>
    </View>
  );
}
