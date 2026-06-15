import { useEffect, useRef } from 'react';
import { Card, Button, Space, Tag, Typography } from 'antd';
import type { ActionChunkData } from '@/api/agent';
import styles from '../AgentChatPage.module.scss';

interface ActionConfirmProps {
  action: ActionChunkData;
  onConfirm: () => void;
  onCancel?: () => void;
  loading?: boolean;
}

export function ActionConfirm({
  action,
  onConfirm,
  onCancel,
  loading,
}: ActionConfirmProps) {
  const autoTriggeredRef = useRef(false);

  useEffect(() => {
    if (!action.requiresConfirmation && !autoTriggeredRef.current && !loading) {
      autoTriggeredRef.current = true;
      onConfirm();
    }
  }, [action.requiresConfirmation, loading, onConfirm]);

  return (
    <Card
      size="small"
      title={
        action.requiresConfirmation ? '确认执行以下操作' : '将自动执行以下操作'
      }
      className={styles.actionConfirmCard}
    >
      <Typography.Paragraph>{action.summary}</Typography.Paragraph>

      {action.impact.length > 0 && (
        <div className={styles.actionImpact}>
          <Typography.Text type="secondary">影响范围：</Typography.Text>
          <Space size="small" wrap>
            {action.impact.map((item, i) => (
              <Tag key={i} color="blue">
                {item}
              </Tag>
            ))}
          </Space>
        </div>
      )}

      <div className={styles.actionMeta}>
        <Tag color="processing">
          {action.method} {action.path}
        </Tag>
      </div>

      {action.requiresConfirmation ? (
        <Space>
          <Button type="primary" loading={loading} onClick={onConfirm}>
            确认执行
          </Button>
          {onCancel && <Button onClick={onCancel}>取消</Button>}
        </Space>
      ) : (
        <Button type="primary" loading={loading} onClick={onConfirm}>
          执行
        </Button>
      )}
    </Card>
  );
}
