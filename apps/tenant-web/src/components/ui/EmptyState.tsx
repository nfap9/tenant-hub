import { Button } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import styles from './EmptyState.module.scss';
import clsx from 'clsx';

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({
  title = '暂无数据',
  description = '当前没有相关记录',
  action,
}: EmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyStateIconBox}>
        <InboxOutlined />
      </div>
      <div className={styles.emptyStateTitle}>{title}</div>
      <div className={clsx(styles.emptyStateDesc, action && styles.hasAction)}>
        {description}
      </div>
      {action && (
        <Button type="primary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
