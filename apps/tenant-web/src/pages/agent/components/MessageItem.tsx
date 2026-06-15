import { Avatar } from 'antd';
import { RobotOutlined, UserOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChartRenderer } from '../ChartRender';
import { DynamicForm } from './DynamicForm';
import { ActionConfirm } from './ActionConfirm';
import styles from '../AgentChatPage.module.scss';
import type { DisplayMessage } from '../types';

interface MessageItemProps {
  message: DisplayMessage;
  onFormSubmit?: (messageId: string, values: Record<string, unknown>) => void;
  onActionConfirm?: (messageId: string) => void;
  onActionCancel?: (messageId: string) => void;
  executingActionId?: string | null;
}

export function MessageItem({
  message,
  onFormSubmit,
  onActionConfirm,
  onActionCancel,
  executingActionId,
}: MessageItemProps) {
  const roleClass = styles[message.role as keyof typeof styles];

  const renderAvatar = () => {
    if (message.role === 'user') {
      return (
        <Avatar
          className={styles.avatar}
          icon={<UserOutlined />}
          style={{ background: '#2563eb' }}
        />
      );
    }
    if (
      message.role === 'assistant' ||
      message.role === 'form' ||
      message.role === 'action'
    ) {
      return (
        <Avatar
          className={styles.avatar}
          icon={<RobotOutlined />}
          style={{ background: '#22c55e' }}
        />
      );
    }
    return <div style={{ width: 40 }} />;
  };

  return (
    <div className={`${styles.messageRow} ${roleClass}`}>
      {renderAvatar()}

      <div className={`${styles.messageBubble} ${roleClass}`}>
        {message.loading ? (
          <div className={styles.typingIndicator}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        ) : (
          <>
            {message.thinking && message.thinking.length > 0 && (
              <details className={styles.thinkingPanel}>
                <summary className={styles.thinkingSummary}>
                  思考过程 ({message.thinking.length} 步)
                </summary>
                <ol className={styles.thinkingList}>
                  {message.thinking.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </details>
            )}
            {message.content && !message.formData && !message.actionData && (
              <div className={styles.markdownBody}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
            {message.chartData && <ChartRenderer config={message.chartData} />}
            {message.formData && onFormSubmit && (
              <DynamicForm
                fields={message.formData.fields}
                reason={message.formData.reason}
                onSubmit={(values) => onFormSubmit(message.id, values)}
              />
            )}
            {message.actionData && onActionConfirm && (
              <ActionConfirm
                action={message.actionData}
                onConfirm={() => onActionConfirm(message.id)}
                onCancel={
                  onActionCancel ? () => onActionCancel(message.id) : undefined
                }
                loading={executingActionId === message.id}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
