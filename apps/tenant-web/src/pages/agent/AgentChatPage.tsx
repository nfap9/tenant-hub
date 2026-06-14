import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAppSession } from '@/context/AppSessionContext';

import styles from './AgentChatPage.module.scss';
import { useAgentChat } from './hooks/useAgentChat';
import { useSwitchConversation } from './hooks/useSwitchConversation';
import { useSendMessage } from './hooks/useSendMessage';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';
import { WelcomeCard } from './components/WelcomeCard';
import { ConversationHeader } from './components/ConversationHeader';

export default function AgentChatPage() {
  const { currentOrgId } = useAppSession();
  const orgId = currentOrgId || 'default';
  const navigate = useNavigate();
  const location = useLocation();
  const processedSearchRef = useRef('');

  const { conversation, setConversation, isReady, storageKey } =
    useAgentChat(orgId);
  const { switchConversation } = useSwitchConversation({
    setConversation,
    storageKey,
  });
  const handleConversationCreate = useCallback(
    (id: string) => {
      // 标记已处理，避免 URL 参数 effect 又把当前会话当成外部切换重新加载
      processedSearchRef.current = `?conv=${id}`;
      navigate(`/agent?conv=${id}`, { replace: true });
    },
    [navigate]
  );

  const { sendMessage, isLoading, abort } = useSendMessage({
    orgId,
    conversation,
    setConversation,
    storageKey,
    onConversationCreate: handleConversationCreate,
  });

  const [input, setInput] = useState('');

  // 响应 URL 参数：新建对话或切换会话
  useEffect(() => {
    const search = location.search;
    if (processedSearchRef.current === search) return;
    processedSearchRef.current = search;

    const params = new URLSearchParams(search);
    const action = params.get('action');
    const convId = params.get('conv');

    if (action === 'new') {
      abort();
      setConversation(undefined);
      navigate('/agent', { replace: true });
    } else if (convId && convId !== conversation?.id) {
      abort();
      switchConversation(convId);
    }
  }, [
    location.search,
    switchConversation,
    conversation?.id,
    navigate,
    setConversation,
    abort,
  ]);

  // 切换/新建会话后清空输入框
  useEffect(() => {
    setInput('');
  }, [conversation?.id]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const text = input;
    setInput('');
    await sendMessage(text);
  }, [input, isLoading, sendMessage]);

  const handlePromptClick = useCallback(
    (prompt: string) => {
      setInput(prompt);
    },
    [setInput]
  );

  if (!isReady) {
    return (
      <div className={styles.agentChatPage}>
        <Spin className={styles.loading} />
      </div>
    );
  }

  const messages = conversation?.messages ?? [];

  return (
    <div className={styles.agentChatPage}>
      <div className={styles.chatArea}>
        {conversation && messages.length > 0 && (
          <ConversationHeader title={conversation.title} />
        )}
        {messages.length === 0 ? (
          <WelcomeCard onPromptClick={handlePromptClick} />
        ) : (
          <MessageList messages={messages} />
        )}
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          loading={isLoading}
          disabled={isLoading}
        />
      </div>
    </div>
  );
}
