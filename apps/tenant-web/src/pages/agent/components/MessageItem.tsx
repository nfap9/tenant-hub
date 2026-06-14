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

  return (
    <div className={`${styles.messageRow} ${roleClass}`}>
      {message.role === 'user' && (
        <Avatar
          className={styles.avatar}
          icon={<UserOutlined />}
          style={{ background: '#2563eb' }}
        />
      )}
      {message.role === 'assistant' && (
        <Avatar
          className={styles.avatar}
          icon={<RobotOutlined />}
          style={{ background: '#22c55e' }}
        />
      )}
      {(message.role === 'error' || message.role === 'status') && (
        <div style={{ width: 40 }} />
      )}

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
