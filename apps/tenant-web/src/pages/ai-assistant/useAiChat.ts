import { useState } from 'react';
import type { ChatMessage } from './types';
import useAiModels from './hooks/useAiModels';
import useAiConversations from './hooks/useAiConversations';
import useChatStream from './hooks/useChatStream';
import usePendingActions from './hooks/usePendingActions';

/**
 * 租务助手对话状态的总装配层：
 * 共享的 messages 状态放在这里，各职责 hook 通过 setMessages 读写。
 * 实现细节见 hooks/（模型、会话、对话流、待确认操作）与 utils/messages.ts（纯函数）。
 */
export default function useAiChat(open: boolean) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const { models, modelId, setModelId } = useAiModels(open);

  const {
    conversations,
    currentConv,
    loadingHistory,
    loadConversations,
    createConversation,
    startNewConversation,
    selectConversation,
    handleArchive,
  } = useAiConversations({ open, modelId, setModelId, setMessages });

  const { input, setInput, streaming, send, handleAbort } = useChatStream({
    currentConv,
    modelId,
    createConversation,
    loadConversations,
    setMessages,
  });

  const { busyActionId, handleConfirm, handleReject } = usePendingActions({
    setMessages,
  });

  return {
    models,
    modelId,
    setModelId,
    conversations,
    currentConv,
    messages,
    input,
    setInput,
    streaming,
    loadingHistory,
    busyActionId,
    startNewConversation,
    selectConversation,
    handleArchive,
    handleConfirm,
    handleReject,
    send,
    handleAbort,
  };
}
