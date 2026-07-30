import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { message } from 'antd';
import { streamAiChat, type AiConversationSummary } from '@/api/ai';
import type { ChatMessage } from '../types';
import {
  applyAgentEventToMessages,
  markMessageError,
  settlePendingMessages,
} from '../utils/messages';

type Params = {
  currentConv: AiConversationSummary | null;
  modelId: string | undefined;
  /** 无当前会话时，发送首条消息前自动创建会话 */
  createConversation: (modelId?: string) => Promise<AiConversationSummary>;
  /** 流结束后刷新会话列表（updatedAt 变化） */
  loadConversations: () => Promise<void>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
};

/** 对话流：输入框、发送（SSE）、中止 */
export default function useChatStream({
  currentConv,
  modelId,
  createConversation,
  loadConversations,
  setMessages,
}: Params) {
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      let conv = currentConv;
      if (!conv) {
        try {
          conv = await createConversation(modelId);
        } catch (e) {
          message.error(e instanceof Error ? e.message : '创建会话失败');
          return;
        }
      }

      const userMsg: ChatMessage = {
        id: `local-${Date.now()}`,
        role: 'user',
        text: trimmed,
      };
      const assistantMsg: ChatMessage = {
        id: `pending-${Date.now()}`,
        role: 'assistant',
        text: '',
        pending: true,
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput('');
      setStreaming(true);

      abortRef.current = streamAiChat({
        conversationId: conv.id,
        message: trimmed,
        modelId,
        onEvent: (event) => {
          setMessages((prev) =>
            applyAgentEventToMessages(prev, event, assistantMsg.id)
          );
          if (event.type === 'error') message.error(event.message);
        },
        onError: (error) => {
          setMessages((prev) =>
            markMessageError(prev, assistantMsg.id, error.message)
          );
          message.error(error.message);
        },
        onClose: () => {
          setStreaming(false);
          abortRef.current = null;
          loadConversations();
        },
      });
    },
    [
      currentConv,
      modelId,
      streaming,
      createConversation,
      loadConversations,
      setMessages,
    ]
  );

  const handleAbort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setMessages((prev) => settlePendingMessages(prev));
  }, [setMessages]);

  return { input, setInput, streaming, send, handleAbort };
}
