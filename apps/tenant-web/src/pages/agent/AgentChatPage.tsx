import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Spin, Drawer, Modal } from 'antd';
import { useAppSession } from '@/context/AppSessionContext';

import styles from './AgentChatPage.module.scss';
import { useAgentChat } from './hooks/useAgentChat';
import { useSwitchConversation } from './hooks/useSwitchConversation';
import { useSendMessage } from './hooks/useSendMessage';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';
import { WelcomeCard } from './components/WelcomeCard';
import { ConversationHeader } from './components/ConversationHeader';
import { DynamicForm } from './components/DynamicForm';
import { ActionConfirm } from './components/ActionConfirm';

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
      processedSearchRef.current = `?conv=${id}`;
      navigate(`/agent?conv=${id}`, { replace: true });
    },
    [navigate]
  );

  const {
    sendMessage,
    submitToolResult,
    cancelToolCall,
    activeToolCall,
    isLoading,
    abort,
  } = useSendMessage({
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

      {/* Tool Call: Form → Drawer */}
      {activeToolCall?.toolCall.kind === 'form' && (
        <Drawer
          title={activeToolCall.toolCall.reason || '填写表单'}
          open={true}
          onClose={cancelToolCall}
          width={480}
          destroyOnClose
        >
          <DynamicForm
            fields={activeToolCall.toolCall.fields ?? []}
            onSubmit={(values) => submitToolResult(values)}
            onCancel={cancelToolCall}
          />
        </Drawer>
      )}

      {/* Tool Call: Confirmation → Modal */}
      {activeToolCall?.toolCall.kind === 'confirmation' && (
        <Modal
          title="确认执行以下操作"
          open={true}
          onCancel={cancelToolCall}
          footer={null}
          destroyOnClose
        >
          <ActionConfirm
            action={{
              tool: activeToolCall.toolCall.tool,
              method: activeToolCall.toolCall.method ?? '',
              path: activeToolCall.toolCall.path ?? '',
              params: activeToolCall.toolCall.params ?? {},
              summary: activeToolCall.toolCall.summary ?? '',
              impact: activeToolCall.toolCall.impact ?? [],
              requiresConfirmation:
                activeToolCall.toolCall.requiresConfirmation ?? true,
            }}
            onConfirm={() => {
              submitToolResult(activeToolCall.toolCall.params ?? {});
            }}
            onCancel={cancelToolCall}
            loading={isLoading}
          />
        </Modal>
      )}
    </div>
  );
}
