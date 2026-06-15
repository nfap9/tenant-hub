import { useCallback, useRef, useState } from 'react';
import { message } from 'antd';
import {
  manifestChatWithAgent,
  createConversation as createServerConversation,
  saveMessages,
  updateConversation,
  executeAgentAction,
  type ChatMessage,
  type SavedMessage,
} from '@/api/agent';
import type { LocalConversation, DisplayMessage } from '../types';
import {
  readConversations,
  writeConversations,
  dispatchConversationsChange,
} from '../storage';

interface UseSendMessageOptions {
  orgId: string;
  conversation: LocalConversation | undefined;
  setConversation: React.Dispatch<
    React.SetStateAction<LocalConversation | undefined>
  >;
  storageKey: string;
  onConversationCreate?: (id: string) => void;
}

const MAX_HISTORY_MESSAGES = 20;

function isDefaultTitle(title: string) {
  return title === '新对话' || !title;
}

function makeTitleFromMessage(text: string) {
  return text.trim().slice(0, 20) || '新对话';
}

function describeForHistory(m: DisplayMessage): string {
  if (m.role === 'form' && m.formData) {
    return `[需要补充表单：${m.formData.reason || m.formData.tool}]`;
  }
  if (m.role === 'action' && m.actionData) {
    return `[待确认操作：${m.actionData.summary}]`;
  }
  return m.content;
}

function buildHistory(messages: DisplayMessage[]): ChatMessage[] {
  return messages
    .filter((m) => ['user', 'assistant', 'form', 'action'].includes(m.role))
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: describeForHistory(m),
    }));
}

function summarizeValues(values: Record<string, unknown>): string {
  const entries = Object.entries(values)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  if (entries.length === 0) return '（无有效内容）';
  return entries.join('\n');
}

export function useSendMessage({
  orgId,
  conversation,
  setConversation,
  storageKey,
  onConversationCreate,
}: UseSendMessageOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [executingActionId, setExecutingActionId] = useState<string | null>(
    null
  );
  const abortControllerRef = useRef<AbortController | null>(null);
  const latestMessagesRef = useRef<DisplayMessage[]>([]);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const syncConversationToCache = useCallback(
    (conv: LocalConversation) => {
      const list = readConversations(storageKey).filter(
        (c) => c.id !== conv.id
      );
      writeConversations(storageKey, [conv, ...list]);
      dispatchConversationsChange();
    },
    [storageKey]
  );

  const persistAfterStream = useCallback(
    async (conv: LocalConversation) => {
      const serverId = conv.serverId;
      if (!serverId) {
        // 无后端会话时不进行服务端持久化
        return;
      }

      let updatedConv = conv;

      const firstUser = conv.messages.find((m) => m.role === 'user');
      if (firstUser && isDefaultTitle(conv.title)) {
        const newTitle = makeTitleFromMessage(firstUser.content);
        try {
          await updateConversation(serverId, { title: newTitle });
          updatedConv = { ...updatedConv, title: newTitle };
          setConversation((prev) =>
            prev?.id === conv.id ? { ...prev, title: newTitle } : prev
          );
        } catch {
          // 标题更新失败不影响消息保存
        }
      }

      const toSave: SavedMessage[] = conv.messages
        .filter((m) =>
          ['user', 'assistant', 'status', 'error', 'form', 'action'].includes(
            m.role
          )
        )
        .map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          chartData: m.chartData,
          thinking: m.thinking,
          formData: m.formData,
          actionData: m.actionData,
        }));

      try {
        await saveMessages(serverId, toSave);

        const list = readConversations(storageKey).filter(
          (c) => c.id !== conv.id
        );
        writeConversations(storageKey, [
          { ...updatedConv, messages: toSave as DisplayMessage[] },
          ...list,
        ]);
        dispatchConversationsChange();
      } catch {
        message.error('保存消息失败');
      }
    },
    [setConversation, storageKey]
  );

  const runAgentStream = useCallback(
    async (
      workingConversation: LocalConversation,
      userText: string,
      initialMessages: DisplayMessage[]
    ) => {
      const statusId = crypto.randomUUID();
      const assistantId = crypto.randomUUID();

      latestMessagesRef.current = initialMessages;
      setConversation((prev) =>
        prev?.id === workingConversation.id
          ? {
              ...prev,
              updatedAt: Date.now(),
              messages: initialMessages,
              loading: true,
            }
          : prev
      );

      syncConversationToCache({
        ...workingConversation,
        messages: initialMessages,
        updatedAt: Date.now(),
        loading: true,
      });

      const history = buildHistory(
        initialMessages.filter((m) => m.id !== statusId)
      );

      try {
        const stream = manifestChatWithAgent(userText, history, orgId, {
          conversationId:
            workingConversation.serverId || workingConversation.id,
          signal: abortControllerRef.current?.signal,
        });

        for await (const chunk of stream) {
          if (chunk.type === 'status') {
            const next = latestMessagesRef.current
              .filter((m) => m.id !== statusId)
              .concat({
                id: statusId,
                role: 'status',
                content: chunk.content,
              } as DisplayMessage);
            latestMessagesRef.current = next;
            setConversation((prev) =>
              prev?.id === workingConversation.id
                ? { ...prev, messages: next }
                : prev
            );
          } else if (chunk.type === 'message') {
            const base = latestMessagesRef.current.filter(
              (m) => m.id !== statusId
            );
            const existing = base.find((m) => m.id === assistantId);
            const next = existing
              ? base.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + chunk.content }
                    : m
                )
              : [
                  ...base,
                  {
                    id: assistantId,
                    role: 'assistant',
                    content: chunk.content,
                  } as DisplayMessage,
                ];
            latestMessagesRef.current = next;
            setConversation((prev) =>
              prev?.id === workingConversation.id
                ? { ...prev, messages: next }
                : prev
            );
          } else if (chunk.type === 'chart') {
            try {
              const chartData = JSON.parse(chunk.content);
              const base = latestMessagesRef.current.filter(
                (m) => m.id !== statusId
              );
              const existing = base.find((m) => m.id === assistantId);
              const next = existing
                ? base.map((m) =>
                    m.id === assistantId ? { ...m, chartData } : m
                  )
                : [
                    ...base,
                    {
                      id: assistantId,
                      role: 'assistant',
                      content: '',
                      chartData,
                    } as DisplayMessage,
                  ];
              latestMessagesRef.current = next;
              setConversation((prev) =>
                prev?.id === workingConversation.id
                  ? { ...prev, messages: next }
                  : prev
              );
            } catch {
              // 图表数据解析失败，忽略
            }
          } else if (chunk.type === 'form' && chunk.form) {
            const next = latestMessagesRef.current
              .filter((m) => m.id !== statusId)
              .concat({
                id: crypto.randomUUID(),
                role: 'form',
                content: chunk.form.reason || '请补充以下信息',
                formData: chunk.form,
              } as DisplayMessage);
            latestMessagesRef.current = next;
            setConversation((prev) =>
              prev?.id === workingConversation.id
                ? { ...prev, messages: next }
                : prev
            );
          } else if (chunk.type === 'action' && chunk.action) {
            const next = latestMessagesRef.current
              .filter((m) => m.id !== statusId)
              .concat({
                id: crypto.randomUUID(),
                role: 'action',
                content: chunk.action.summary,
                actionData: chunk.action,
              } as DisplayMessage);
            latestMessagesRef.current = next;
            setConversation((prev) =>
              prev?.id === workingConversation.id
                ? { ...prev, messages: next }
                : prev
            );
          } else if (chunk.type === 'error') {
            const next = latestMessagesRef.current
              .filter((m) => m.id !== statusId)
              .concat({
                id: crypto.randomUUID(),
                role: 'error',
                content: chunk.content,
              } as DisplayMessage);
            latestMessagesRef.current = next;
            setConversation((prev) =>
              prev?.id === workingConversation.id
                ? { ...prev, messages: next }
                : prev
            );
          } else if (chunk.type === 'done') {
            break;
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // 用户主动中断，不显示错误
        } else {
          const next = latestMessagesRef.current
            .filter((m) => m.id !== statusId)
            .concat({
              id: crypto.randomUUID(),
              role: 'error',
              content:
                error instanceof Error ? error.message : '发送失败，请重试',
            } as DisplayMessage);
          latestMessagesRef.current = next;
          setConversation((prev) =>
            prev?.id === workingConversation.id
              ? { ...prev, messages: next }
              : prev
          );
        }
      } finally {
        const next = latestMessagesRef.current.filter((m) => m.id !== statusId);
        latestMessagesRef.current = next;
        setConversation((prev) =>
          prev?.id === workingConversation.id
            ? { ...prev, messages: next, updatedAt: Date.now(), loading: false }
            : prev
        );

        if (workingConversation.serverId) {
          await persistAfterStream({
            ...workingConversation,
            messages: next,
            updatedAt: Date.now(),
            loading: false,
          });
        } else {
          syncConversationToCache({
            ...workingConversation,
            messages: next,
            updatedAt: Date.now(),
            loading: false,
          });
        }

        abortControllerRef.current = null;
        setIsLoading(false);
      }
    },
    [orgId, persistAfterStream, syncConversationToCache, setConversation]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      setIsLoading(true);
      abortControllerRef.current = new AbortController();

      const trimmed = text.trim();
      const userMessage: DisplayMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
      };
      const statusMessage: DisplayMessage = {
        id: crypto.randomUUID(),
        role: 'status',
        content: '正在分析...',
      };

      // 如果当前没有会话（空会话页面），先创建本地草稿会话
      let workingConversation: LocalConversation;
      if (!conversation) {
        workingConversation = {
          id: crypto.randomUUID(),
          title: makeTitleFromMessage(trimmed),
          updatedAt: Date.now(),
          messages: [],
          loading: true,
        };
        setConversation(workingConversation);
      } else {
        workingConversation = { ...conversation, loading: true };
        setConversation(workingConversation);
      }

      const initialMessages: DisplayMessage[] = [
        ...workingConversation.messages,
        userMessage,
        statusMessage,
      ];

      // 首次发送时立即创建后端会话，确保会话记录已经生成
      if (!workingConversation.serverId) {
        try {
          const server = await createServerConversation(
            workingConversation.title || '新对话'
          );
          const serverId = server.id;
          const oldId = workingConversation.id;

          workingConversation.id = serverId;
          workingConversation.serverId = serverId;

          setConversation((prev) =>
            prev?.id === oldId
              ? { ...prev, id: serverId, serverId, loading: true }
              : prev
          );

          onConversationCreate?.(serverId);

          syncConversationToCache({
            ...workingConversation,
            messages: initialMessages,
            updatedAt: Date.now(),
            loading: true,
          });
        } catch {
          // 后端会话创建失败时降级为本地会话，仍允许用户继续对话
        }
      }

      await runAgentStream(workingConversation, trimmed, initialMessages);
    },
    [conversation, isLoading, runAgentStream, onConversationCreate]
  );

  const submitForm = useCallback(
    async (messageId: string, values: Record<string, unknown>) => {
      if (isLoading || !conversation) return;

      const formMessage = conversation.messages.find((m) => m.id === messageId);
      if (!formMessage || formMessage.role !== 'form') return;

      setIsLoading(true);
      abortControllerRef.current = new AbortController();

      const userText = `已补充信息：\n${summarizeValues(values)}`;
      const userMessage: DisplayMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: userText,
      };
      const statusMessage: DisplayMessage = {
        id: crypto.randomUUID(),
        role: 'status',
        content: '正在处理...',
      };

      const workingConversation = { ...conversation, loading: true };
      setConversation(workingConversation);

      const initialMessages: DisplayMessage[] = [
        ...workingConversation.messages,
        userMessage,
        statusMessage,
      ];

      await runAgentStream(workingConversation, userText, initialMessages);
    },
    [conversation, isLoading, runAgentStream]
  );

  const confirmAction = useCallback(
    async (messageId: string) => {
      if (isLoading || !conversation) return;

      const actionMessage = conversation.messages.find(
        (m) => m.id === messageId
      );
      if (
        !actionMessage ||
        actionMessage.role !== 'action' ||
        !actionMessage.actionData
      )
        return;

      setExecutingActionId(messageId);
      const action = actionMessage.actionData;

      try {
        const result = await executeAgentAction({
          tool: action.tool,
          path: action.path,
          params: action.params,
        });

        const resultText =
          typeof result === 'object'
            ? JSON.stringify(result, null, 2)
            : String(result ?? '执行成功');
        const userText = `已确认执行，结果：\n${resultText}`;

        setExecutingActionId(null);
        setIsLoading(true);
        abortControllerRef.current = new AbortController();

        const userMessage: DisplayMessage = {
          id: crypto.randomUUID(),
          role: 'user',
          content: userText,
        };
        const statusMessage: DisplayMessage = {
          id: crypto.randomUUID(),
          role: 'status',
          content: '正在处理...',
        };

        const workingConversation = { ...conversation, loading: true };
        setConversation(workingConversation);

        const initialMessages: DisplayMessage[] = [
          ...workingConversation.messages,
          userMessage,
          statusMessage,
        ];

        await runAgentStream(workingConversation, userText, initialMessages);
      } catch (error) {
        setExecutingActionId(null);
        const errorText =
          error instanceof Error ? error.message : '操作执行失败';
        const next = conversation.messages.concat({
          id: crypto.randomUUID(),
          role: 'error',
          content: errorText,
        } as DisplayMessage);
        setConversation((prev) =>
          prev?.id === conversation.id
            ? { ...prev, messages: next, updatedAt: Date.now(), loading: false }
            : prev
        );
        syncConversationToCache({
          ...conversation,
          messages: next,
          updatedAt: Date.now(),
          loading: false,
        });
      }
    },
    [conversation, isLoading, runAgentStream, syncConversationToCache]
  );

  const cancelAction = useCallback(
    (messageId: string) => {
      if (!conversation) return;
      const next = conversation.messages.filter((m) => m.id !== messageId);
      const updated = {
        ...conversation,
        messages: next,
        updatedAt: Date.now(),
      };
      setConversation(updated);
      latestMessagesRef.current = next;
      syncConversationToCache(updated);
    },
    [conversation, syncConversationToCache]
  );

  return {
    sendMessage,
    submitForm,
    confirmAction,
    cancelAction,
    isLoading,
    executingActionId,
    abort,
  };
}
