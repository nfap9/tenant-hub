import styles from '../AgentChatPage.module.scss';

interface ConversationHeaderProps {
  title: string;
}

export function ConversationHeader({ title }: ConversationHeaderProps) {
  return (
    <div className={styles.chatHeader}>
      <div className={styles.chatTitle}>{title || '新对话'}</div>
    </div>
  );
}
