import { View, Text } from '@tarojs/components';
import { useEffect, useState } from 'react';
import './TaskSheet.scss';

export type TaskSheetVariant = 'drawer' | 'dialog';

export type TaskSheetProps = {
  visible: boolean;
  variant?: TaskSheetVariant;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function TaskSheet({
  visible,
  variant = 'drawer',
  title,
  subtitle,
  onClose,
  children,
  footer,
}: TaskSheetProps) {
  const [show, setShow] = useState(false);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      requestAnimationFrame(() => setAnimated(true));
    } else {
      setAnimated(false);
      const timer = setTimeout(() => setShow(false), 300);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!show) return null;

  return (
    <View className={`task-sheet ${animated ? 'task-sheet--active' : ''}`}>
      <View className="task-sheet__overlay" onClick={onClose} />
      <View className={`task-sheet__content task-sheet__content--${variant}`}>
        <View className="task-sheet__header">
          <View className="task-sheet__title-block">
            <Text className="task-sheet__title">{title}</Text>
            {subtitle && (
              <Text className="task-sheet__subtitle">{subtitle}</Text>
            )}
          </View>
          <View className="task-sheet__close" onClick={onClose}>
            <Text>关闭</Text>
          </View>
        </View>
        <View className="task-sheet__body">{children}</View>
        {footer && <View className="task-sheet__footer">{footer}</View>}
      </View>
    </View>
  );
}
