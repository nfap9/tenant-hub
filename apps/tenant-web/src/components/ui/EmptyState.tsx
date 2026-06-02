import { Button, Empty } from 'antd';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  size?: 'default' | 'small';
  children?: ReactNode;
}

export default function EmptyState({
  title,
  description,
  action,
  size = 'default',
  children,
}: EmptyStateProps) {
  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <div>
          {title && (
            <div
              style={{
                fontWeight: 600,
                fontSize: size === 'small' ? 13 : 14,
                color: 'var(--th-foreground)',
                marginBottom: 4,
              }}
            >
              {title}
            </div>
          )}
          {description && (
            <div
              style={{
                fontSize: size === 'small' ? 12 : 13,
                color: 'var(--th-foreground-muted)',
              }}
            >
              {description}
            </div>
          )}
        </div>
      }
      style={{
        padding: size === 'small' ? '32px 0' : '64px 0',
      }}
    >
      {action && (
        <Button type="primary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
      {children}
    </Empty>
  );
}
