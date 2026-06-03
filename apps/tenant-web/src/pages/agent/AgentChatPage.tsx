import { useState, useRef, useEffect, useCallback } from 'react';
import { Input, Button, Avatar, message as antMessage } from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { useAppSession } from '@/context/AppSessionContext';
import { chatWithAgent, type ChatMessage } from '@/api/agent';
import styles from './AgentChatPage.module.scss';

const QUICK_QUESTIONS = [
  '查看公寓概览',
  '查询空置房间',
  '本月经营数据',
  '查询未缴账单',
  '即将到期的租约',
];

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'status' | 'error';
  content: string;
  loading?: boolean;
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function AgentChatPage() {
  const { currentOrgId } = useAppSession();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !currentOrgId || isLoading) return;

      const userMsg: DisplayMessage = {
        id: generateId(),
        role: 'user',
        content: text.trim(),
      };

      const assistantMsg: DisplayMessage = {
        id: generateId(),
        role: 'assistant',
        content: '',
        loading: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput('');
      setIsLoading(true);
      abortRef.current = false;

      // 构建历史记录（排除 status/error 消息，只保留 user/assistant）
      const history: ChatMessage[] = [];
      for (const m of messages.slice(-10)) {
        if (m.role === 'user' || m.role === 'assistant') {
          history.push({ role: m.role, content: m.content });
        }
      }

      try {
        const stream = chatWithAgent(text.trim(), history, currentOrgId);
        let fullContent = '';

        for await (const chunk of stream) {
          if (abortRef.current) break;

          if (chunk.type === 'status') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, content: fullContent, loading: true }
                  : m
              )
            );
          } else if (chunk.type === 'message') {
            fullContent += chunk.content;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, content: fullContent, loading: false }
                  : m
              )
            );
          } else if (chunk.type === 'error') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? {
                      ...m,
                      role: 'error',
                      content: chunk.content,
                      loading: false,
                    }
                  : m
              )
            );
            break;
          } else if (chunk.type === 'done') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, content: fullContent, loading: false }
                  : m
              )
            );
            break;
          }
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : '请求失败，请重试';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, role: 'error', content: errorMsg, loading: false }
              : m
          )
        );
        antMessage.error(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [currentOrgId, isLoading, messages]
  );

  const handleSend = () => {
    if (input.trim()) {
      sendMessage(input);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickQuestion = (q: string) => {
    sendMessage(q);
  };

  return (
    <div className={styles.agentChatPage}>
      <div className={styles.chatContainer}>
        <div className={styles.messagesArea}>
          {messages.length === 0 && (
            <div className={styles.welcomeCard}>
              <RobotOutlined
                style={{
                  fontSize: 48,
                  color: '#2563eb',
                  marginBottom: 16,
                }}
              />
              <h3>智能助手</h3>
              <p>
                我是您的公寓管理助手，可以帮您查询公寓、房间、租约、账单等信息，
                <br />
                并进行数据分析。
              </p>
              <div className={styles.quickActions}>
                {QUICK_QUESTIONS.map((q) => (
                  <Button
                    key={q}
                    className={styles.quickBtn}
                    icon={<BulbOutlined />}
                    onClick={() => handleQuickQuestion(q)}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.messageRow} ${styles[msg.role]}`}
            >
              {msg.role === 'user' && (
                <Avatar
                  className={styles.avatar}
                  icon={<UserOutlined />}
                  style={{ background: '#2563eb' }}
                />
              )}
              {msg.role === 'assistant' && (
                <Avatar
                  className={styles.avatar}
                  icon={<RobotOutlined />}
                  style={{ background: '#22c55e' }}
                />
              )}
              {(msg.role === 'error' || msg.role === 'status') && (
                <div style={{ width: 40 }} />
              )}

              <div className={`${styles.messageBubble} ${styles[msg.role]}`}>
                {msg.loading && msg.role === 'assistant' ? (
                  <div className={styles.typingIndicator}>
                    <span className={styles.dot} />
                    <span className={styles.dot} />
                    <span className={styles.dot} />
                  </div>
                ) : (
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'inherit',
                    }}
                  >
                    {msg.content}
                  </pre>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className={styles.inputArea}>
          <div className={styles.inputWrapper}>
            <Input.TextArea
              className={styles.textInput}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入您的问题，按 Enter 发送，Shift+Enter 换行..."
              autoSize={{ minRows: 1, maxRows: 4 }}
              disabled={isLoading}
            />
            <Button
              type="primary"
              className={styles.sendBtn}
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={isLoading}
              disabled={!input.trim() || !currentOrgId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
