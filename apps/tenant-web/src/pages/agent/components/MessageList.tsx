import { useEffect, useRef } from 'react';
import { MessageItem } from './MessageItem';
import styles from '../AgentChatPage.module.scss';
import type { DisplayMessage } from '../types';

interface MessageListProps {
  messages: DisplayMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className={styles.messagesArea}>
      {messages.map((msg) => (
        <MessageItem key={msg.id} message={msg} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
