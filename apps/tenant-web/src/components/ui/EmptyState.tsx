import { Button } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import './EmptyState.scss';

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
    <div className="empty-state">
      <div className="empty-state-icon-box">
        <InboxOutlined />
      </div>
      <div className="empty-state-title">{title}</div>
      <div className={`empty-state-desc ${action ? 'has-action' : ''}`}>
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
