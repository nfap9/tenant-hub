import { useEffect, useRef } from 'react';
import { MessageItem } from './MessageItem';
import styles from '../AgentChatPage.module.scss';
import type { DisplayMessage } from '../types';

interface MessageListProps {
  messages: DisplayMessage[];
  onFormSubmit?: (messageId: string, values: Record<string, unknown>) => void;
  onActionConfirm?: (messageId: string) => void;
  onActionCancel?: (messageId: string) => void;
  executingActionId?: string | null;
}

export function MessageList({
  messages,
  onFormSubmit,
  onActionConfirm,
  onActionCancel,
  executingActionId,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className={styles.messagesArea}>
      {messages.map((msg) => (
        <MessageItem
          key={msg.id}
          message={msg}
          onFormSubmit={onFormSubmit}
          onActionConfirm={onActionConfirm}
          onActionCancel={onActionCancel}
          executingActionId={executingActionId}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
}
