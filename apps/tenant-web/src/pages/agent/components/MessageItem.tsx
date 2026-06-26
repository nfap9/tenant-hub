import { Avatar } from 'antd';
import { RobotOutlined, UserOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChartRenderer } from '../ChartRender';
import styles from '../AgentChatPage.module.scss';
import type { DisplayMessage } from '../types';

interface MessageItemProps {
  message: DisplayMessage;
}

export function MessageItem({ message }: MessageItemProps) {
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
    if (message.role === 'assistant') {
      return (
        <Avatar
          className={styles.avatar}
          icon={<RobotOutlined />}
          style={{ background: '#22c55e' }}
        />
      );
    }
    if (message.role === 'status') {
      return (
        <Avatar
          className={styles.avatar}
          icon={<RobotOutlined />}
          style={{ background: '#f0f0f0', color: '#9ca3af' }}
        />
      );
    }
    return <div style={{ width: 40 }} />;
  };

  return (
    <div className={`${styles.messageRow} ${roleClass}`}>
      {renderAvatar()}

      <div className={`${styles.messageBubble} ${roleClass}`}>
        {message.role === 'status' ? (
          <span className={styles.statusText}>{message.content}</span>
        ) : message.loading ||
          (message.role === 'assistant' && message.statusText) ? (
          <div className={styles.processingIndicator}>
            <span className={styles.processingIcon}>
              <RobotOutlined />
            </span>
            <span>{message.statusText || '思考中...'}</span>
            <span className={styles.processingDots}>
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
            </span>
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
            {message.content && (
              <div className={styles.markdownBody}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
            {message.chartData && <ChartRenderer config={message.chartData} />}
          </>
        )}
      </div>
    </div>
  );
}
