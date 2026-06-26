import { Button, Space, Tag, Typography, Descriptions } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from '../AgentChatPage.module.scss';

interface ActionConfirmData {
  tool: string;
  method: string;
  path: string;
  params: Record<string, unknown>;
  summary: string;
  impact: string[];
  requiresConfirmation: boolean;
}

interface ActionConfirmProps {
  action: ActionConfirmData;
  onConfirm: () => void;
  onCancel?: () => void;
  loading?: boolean;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'object') return JSON.stringify(v, null, 1);
  return String(v);
}

export function ActionConfirm({
  action,
  onConfirm,
  onCancel,
  loading,
}: ActionConfirmProps) {
  const paramEntries = Object.entries(action.params);

  return (
    <>
      {paramEntries.length > 0 ? (
        <Descriptions
          column={1}
          size="small"
          bordered
          style={{ marginBottom: 16 }}
        >
          {paramEntries.map(([key, value]) => (
            <Descriptions.Item key={key} label={key}>
              {formatValue(value)}
            </Descriptions.Item>
          ))}
        </Descriptions>
      ) : (
        <div className={styles.markdownBody} style={{ marginBottom: 16 }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {action.summary}
          </ReactMarkdown>
        </div>
      )}

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
    </>
  );
}
