import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { message } from 'antd';
import {
  archiveAiConversation,
  createAiConversation,
  listAiConversations,
  listAiMessages,
  listAiPendingActions,
  type AiConversationSummary,
} from '@/api/ai';
import type { ChatMessage } from '../types';
import { attachPendingActions, messageFromRecord } from '../utils/messages';

type Params = {
  open: boolean;
  modelId: string | undefined;
  setModelId: (id: string | undefined) => void;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
};

/** 会话管理：列表加载、创建、选择（含历史回放）、归档 */
export default function useAiConversations({
  open,
  modelId,
  setModelId,
  setMessages,
}: Params) {
  const [conversations, setConversations] = useState<AiConversationSummary[]>(
    []
  );
  const [currentConv, setCurrentConv] = useState<AiConversationSummary | null>(
    null
  );
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const list = await listAiConversations();
      setConversations(list);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (open) loadConversations();
  }, [open, loadConversations]);

  /** 创建会话并置为当前会话（同时加入列表顶部）。失败时抛给调用方处理 */
  const createConversation = useCallback(async (forModelId?: string) => {
    const conv = await createAiConversation(forModelId);
    setCurrentConv(conv);
    setConversations((prev) => [conv, ...prev]);
    return conv;
  }, []);

  const startNewConversation = useCallback(async () => {
    if (!modelId) {
      message.warning('暂无可用模型');
      return;
    }
    try {
      await createConversation(modelId);
      setMessages([]);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建会话失败');
    }
  }, [modelId, createConversation, setMessages]);

  const selectConversation = useCallback(
    async (conv: AiConversationSummary) => {
      setCurrentConv(conv);
      setModelId(conv.modelId);
      setLoadingHistory(true);
      try {
        const [records, actions] = await Promise.all([
          listAiMessages(conv.id),
          listAiPendingActions(conv.id),
        ]);
        setMessages(
          attachPendingActions(records.map(messageFromRecord), actions)
        );
      } catch (e) {
        message.error(e instanceof Error ? e.message : '加载历史失败');
      } finally {
        setLoadingHistory(false);
      }
    },
    [setModelId, setMessages]
  );

  const handleArchive = useCallback(
    async (conv: AiConversationSummary) => {
      try {
        await archiveAiConversation(conv.id);
        setConversations((prev) => prev.filter((c) => c.id !== conv.id));
        if (currentConv?.id === conv.id) {
          setCurrentConv(null);
          setMessages([]);
        }
        message.success('已归档');
      } catch (e) {
        message.error(e instanceof Error ? e.message : '归档失败');
      }
    },
    [currentConv, setMessages]
  );

  return {
    conversations,
    currentConv,
    loadingHistory,
    loadConversations,
    createConversation,
    startNewConversation,
    selectConversation,
    handleArchive,
  };
}
