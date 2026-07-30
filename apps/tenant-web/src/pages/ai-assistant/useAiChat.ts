import { useCallback, useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import {
  AiModelOption,
  AiConversationSummary,
  AiMessageRecord,
  AiPendingActionRecord,
  streamAiChat,
  listAiModels,
  listAiConversations,
  createAiConversation,
  listAiMessages,
  listAiPendingActions,
  confirmAiAction,
  rejectAiAction,
  archiveAiConversation,
} from '@/api/ai';
import type { ChatMessage, ChatPendingAction, PendingState } from './types';

const isExpired = (expiresAt: string) =>
  new Date(expiresAt).getTime() < Date.now();

const messageFromRecord = (record: AiMessageRecord): ChatMessage => {
  if (record.role === 'USER') {
    return {
      id: record.id,
      role: 'user',
      text: typeof record.content === 'string' ? record.content : '',
      createdAt: record.createdAt,
    };
  }
  if (record.role === 'ASSISTANT') {
    if (typeof record.content === 'string') {
      return {
        id: record.id,
        role: 'assistant',
        text: record.content,
        createdAt: record.createdAt,
      };
    }
    const obj = record.content as {
      text?: string;
      toolCalls?: { id?: string; name?: string }[];
    };
    return {
      id: record.id,
      role: 'assistant',
      text: obj?.text ?? '',
      toolCalls: (obj?.toolCalls ?? []).map((tc, i) => {
        const name = tc?.name ?? `tool-${i}`;
        return { id: tc?.id, name, summary: `已调用 ${name}` };
      }),
      createdAt: record.createdAt,
    };
  }
  if (record.role === 'TOOL') {
    const obj = record.content as { content?: string };
    return {
      id: record.id,
      role: 'tool',
      text: obj?.content ?? '',
      createdAt: record.createdAt,
    };
  }
  return { id: record.id, role: 'tool', text: '', createdAt: record.createdAt };
};

const stateFromRecord = (record: AiPendingActionRecord): PendingState => {
  switch (record.status) {
    case 'CONFIRMED':
      return 'confirmed';
    case 'REJECTED':
      return 'rejected';
    case 'EXPIRED':
      return 'expired';
    default:
      return isExpired(record.expiresAt) ? 'expired' : 'pending';
  }
};

const findLastMatch = (
  messages: ChatMessage[],
  predicate: (m: ChatMessage) => boolean
): ChatMessage | undefined => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (predicate(messages[i])) return messages[i];
  }
  return undefined;
};

/**
 * 把待确认操作记录归位到对应助手消息之后：
 * 优先按 toolCallId 匹配消息里的 toolCalls，
 * 其次按 toolName，最后兜底到该操作创建前最近的助手消息。
 */
const attachPendingActions = (
  messages: ChatMessage[],
  records: AiPendingActionRecord[]
): ChatMessage[] => {
  const result = messages.map((m) => ({ ...m }));
  for (const record of records) {
    let target = findLastMatch(result, (m) =>
      Boolean(m.toolCalls?.some((tc) => tc.id && tc.id === record.toolCallId))
    );
    if (!target) {
      target = findLastMatch(result, (m) =>
        Boolean(m.toolCalls?.some((tc) => tc.name === record.toolName))
      );
    }
    if (!target) {
      target = findLastMatch(
        result,
        (m) =>
          m.role === 'assistant' &&
          (!m.createdAt || !record.createdAt || m.createdAt <= record.createdAt)
      );
    }
    if (!target) continue;
    const action: ChatPendingAction = {
      id: record.id,
      conversationId: record.conversationId,
      toolCallId: record.toolCallId,
      toolName: record.toolName,
      summary: record.summary,
      expiresAt: record.expiresAt,
      state: stateFromRecord(record),
    };
    target.pendingActions = [...(target.pendingActions ?? []), action];
  }
  return result;
};

export default function useAiChat(open: boolean) {
  const [models, setModels] = useState<AiModelOption[]>([]);
  const [modelId, setModelId] = useState<string | undefined>();
  const [conversations, setConversations] = useState<AiConversationSummary[]>(
    []
  );
  const [currentConv, setCurrentConv] = useState<AiConversationSummary | null>(
    null
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [busyActionId, setBusyActionId] = useState<string | undefined>();

  const abortRef = useRef<AbortController | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const list = await listAiConversations();
      setConversations(list);
    } catch {
      // ignore
    }
  }, []);

  const loadModels = useCallback(async () => {
    try {
      const list = await listAiModels();
      setModels(list);
      setModelId((prev) => prev ?? list[0]?.id);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadModels();
      loadConversations();
    }
  }, [open, loadModels, loadConversations]);

  const startNewConversation = useCallback(async () => {
    if (!modelId) {
      message.warning('暂无可用模型');
      return;
    }
    try {
      const conv = await createAiConversation(modelId);
      setCurrentConv(conv);
      setMessages([]);
      setConversations((prev) => [conv, ...prev]);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建会话失败');
    }
  }, [modelId]);

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
    []
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
    [currentConv]
  );

  const updatePendingAction = useCallback(
    (actionId: string, patch: Partial<ChatPendingAction>) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (!m.pendingActions) return m;
          return {
            ...m,
            pendingActions: m.pendingActions.map((a) =>
              a.id === actionId ? { ...a, ...patch } : a
            ),
          };
        })
      );
    },
    []
  );

  const handleConfirm = useCallback(
    async (action: ChatPendingAction) => {
      setBusyActionId(action.id);
      updatePendingAction(action.id, { state: 'confirming' });
      try {
        const result = await confirmAiAction(action.id);
        updatePendingAction(action.id, {
          state: result.ok ? 'confirmed' : 'expired',
          resultSummary: result.summary,
        });
        if (!result.ok) {
          message.warning(result.summary);
        }
      } catch (e) {
        updatePendingAction(action.id, { state: 'pending' });
        message.error(e instanceof Error ? e.message : '确认失败');
      } finally {
        setBusyActionId(undefined);
      }
    },
    [updatePendingAction]
  );

  const handleReject = useCallback(
    async (action: ChatPendingAction) => {
      setBusyActionId(action.id);
      try {
        await rejectAiAction(action.id);
        updatePendingAction(action.id, {
          state: 'rejected',
          resultSummary: '用户已拒绝',
        });
      } catch (e) {
        message.error(e instanceof Error ? e.message : '拒绝失败');
      } finally {
        setBusyActionId(undefined);
      }
    },
    [updatePendingAction]
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      // 无当前会话时，发送首条消息自动创建会话
      let conv = currentConv;
      if (!conv) {
        try {
          conv = await createAiConversation(modelId);
          setCurrentConv(conv);
          setConversations((prev) => [conv!, ...prev]);
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
          if (event.type === 'text_delta') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, text: m.text + event.delta }
                  : m
              )
            );
          } else if (event.type === 'assistant_message') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, text: event.text, pending: false }
                  : m
              )
            );
          } else if (event.type === 'tool_call') {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantMsg.id) return m;
                const toolCalls = m.toolCalls ?? [];
                const last = toolCalls[toolCalls.length - 1];
                if (last && last.name === event.name && !last.summary) {
                  return {
                    ...m,
                    toolCalls: [
                      ...toolCalls.slice(0, -1),
                      { ...last, summary: event.summary },
                    ],
                  };
                }
                return {
                  ...m,
                  toolCalls: [
                    ...toolCalls,
                    { name: event.name, summary: event.summary },
                  ],
                };
              })
            );
          } else if (event.type === 'pending_action') {
            const pending: ChatPendingAction = {
              ...event.action,
              state: isExpired(event.action.expiresAt) ? 'expired' : 'pending',
            };
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? {
                      ...m,
                      pendingActions: [...(m.pendingActions ?? []), pending],
                    }
                  : m
              )
            );
          } else if (event.type === 'error') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? {
                      ...m,
                      pending: false,
                      error: true,
                      text: m.text || event.message,
                    }
                  : m
              )
            );
            message.error(event.message);
          } else if (event.type === 'done') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id ? { ...m, pending: false } : m
              )
            );
          }
        },
        onError: (error) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? {
                    ...m,
                    pending: false,
                    error: true,
                    text: m.text || error.message,
                  }
                : m
            )
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
    [currentConv, modelId, streaming, loadConversations]
  );

  const handleAbort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setMessages((prev) =>
      prev.map((m) =>
        m.pending ? { ...m, pending: false, text: m.text || '已中止' } : m
      )
    );
  }, []);

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
