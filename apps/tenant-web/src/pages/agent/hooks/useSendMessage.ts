import { useCallback, useRef, useState } from 'react';
import { message } from 'antd';
import {
  chatWithAgent,
  createConversation as createServerConversation,
  saveMessages,
  updateConversation,
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

function buildHistory(messages: DisplayMessage[]): ChatMessage[] {
  return messages
    .filter(
      (
        m
      ): m is DisplayMessage & {
        role: 'user' | 'assistant' | 'tool';
      } => ['user', 'assistant', 'tool'].includes(m.role)
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));
}

function isDefaultTitle(title: string) {
  return title === '新对话' || !title;
}

function makeTitleFromMessage(text: string) {
  return text.trim().slice(0, 20) || '新对话';
}

export function useSendMessage({
  orgId,
  conversation,
  setConversation,
  storageKey,
  onConversationCreate,
}: UseSendMessageOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const latestMessagesRef = useRef<DisplayMessage[]>([]);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

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
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          chartData: m.chartData,
          thinking: m.thinking,
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

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      setIsLoading(true);
      abortControllerRef.current = new AbortController();

      const trimmed = text.trim();

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

      const userMessage: DisplayMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
      };
      const statusId = crypto.randomUUID();
      const assistantId = crypto.randomUUID();

      const initialMessages: DisplayMessage[] = [
        ...workingConversation.messages,
        userMessage,
        {
          id: statusId,
          role: 'status',
          content: '正在分析...',
        } as DisplayMessage,
      ];
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

      // 乐观更新本地缓存：发送消息后立即可见在会话列表中
      const cacheList = readConversations(storageKey).filter(
        (c) => c.id !== workingConversation.id
      );
      writeConversations(storageKey, [
        {
          ...workingConversation,
          messages: initialMessages,
          updatedAt: Date.now(),
          loading: true,
        },
        ...cacheList,
      ]);
      dispatchConversationsChange();

      // 首次发送时立即创建后端会话，确保会话记录已经生成
      if (!workingConversation.serverId) {
        try {
          const server = await createServerConversation(
            workingConversation.title || '新对话'
          );
          const serverId = server.id;
          const oldId = workingConversation.id;

          // 后续流式更新与持久化都使用服务端会话 ID
          workingConversation.id = serverId;
          workingConversation.serverId = serverId;

          setConversation((prev) =>
            prev?.id === oldId
              ? { ...prev, id: serverId, serverId, loading: true }
              : prev
          );

          onConversationCreate?.(serverId);

          const updatedCache = readConversations(storageKey).filter(
            (c) => c.id !== oldId
          );
          writeConversations(storageKey, [
            {
              ...workingConversation,
              messages: initialMessages,
              updatedAt: Date.now(),
              loading: true,
            },
            ...updatedCache,
          ]);
          dispatchConversationsChange();
        } catch {
          // 后端会话创建失败时降级为本地会话，仍允许用户继续对话
        }
      }

      const history = buildHistory(workingConversation.messages);

      try {
        const stream = chatWithAgent(trimmed, history, orgId, {
          conversationId:
            workingConversation.serverId || workingConversation.id,
          signal: abortControllerRef.current.signal,
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
          // 本地-only 会话：仅取消生成状态
          const localList = readConversations(storageKey).filter(
            (c) => c.id !== workingConversation.id
          );
          writeConversations(storageKey, [
            {
              ...workingConversation,
              messages: next,
              updatedAt: Date.now(),
              loading: false,
            },
            ...localList,
          ]);
          dispatchConversationsChange();
        }

        abortControllerRef.current = null;
        setIsLoading(false);
      }
    },
    [
      conversation,
      orgId,
      isLoading,
      setConversation,
      persistAfterStream,
      storageKey,
      onConversationCreate,
    ]
  );

  return { sendMessage, isLoading, abort };
}
