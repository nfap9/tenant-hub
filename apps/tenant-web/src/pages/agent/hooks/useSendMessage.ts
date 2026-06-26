import { useCallback, useRef, useState } from 'react';
import { message } from 'antd';
import {
  manifestChatWithAgent,
  submitToolResult as submitToolResultApi,
  createConversation as createServerConversation,
  saveMessages,
  updateConversation,
  type ChatMessage,
  type SavedMessage,
  type ToolCallChunkData,
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

function buildHistory(messages: DisplayMessage[]): ChatMessage[] {
  return messages
    .filter((m) => ['user', 'assistant'].includes(m.role))
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    }));
}

export function useSendMessage({
  orgId,
  conversation,
  setConversation,
  storageKey,
  onConversationCreate,
}: UseSendMessageOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeToolCall, setActiveToolCall] = useState<{
    toolCall: ToolCallChunkData;
  } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const latestMessagesRef = useRef<DisplayMessage[]>([]);
  const historyRef = useRef<ChatMessage[]>([]);

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
      if (!serverId) return;

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
          ['user', 'assistant', 'status', 'error'].includes(m.role)
        )
        .map((m) => ({
          id: m.id,
          role: m.role as SavedMessage['role'],
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

  const processStream = useCallback(
    async (
      stream: AsyncGenerator<import('@/api/agent').StreamChunk>,
      workingConversation: LocalConversation,
      initialMessages: DisplayMessage[]
    ) => {
      const assistantId = crypto.randomUUID();
      // Placeholder assistant message: shows loading/status text until real content arrives
      const assistantPlaceholder: DisplayMessage = {
        id: assistantId,
        role: 'assistant' as const,
        content: '',
        statusText: '正在分析...',
      };

      latestMessagesRef.current = [...initialMessages, assistantPlaceholder];
      setConversation((prev) =>
        prev?.id === workingConversation.id
          ? {
              ...prev,
              updatedAt: Date.now(),
              messages: latestMessagesRef.current,
              loading: true,
            }
          : prev
      );

      syncConversationToCache({
        ...workingConversation,
        messages: latestMessagesRef.current,
        updatedAt: Date.now(),
        loading: true,
      });

      let hasRealContent = false;

      try {
        for await (const chunk of stream) {
          if (chunk.type === 'status') {
            const base = latestMessagesRef.current;
            const next = base.map((m) =>
              m.id === assistantId ? { ...m, statusText: chunk.content } : m
            );
            latestMessagesRef.current = next;
            setConversation((prev) =>
              prev?.id === workingConversation.id
                ? { ...prev, messages: next }
                : prev
            );
          } else if (chunk.type === 'message') {
            hasRealContent = true;
            const base = latestMessagesRef.current;
            const existing = base.find((m) => m.id === assistantId);
            const next = existing
              ? base.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: m.content + chunk.content,
                        statusText: undefined,
                      }
                    : m
                )
              : [
                  ...base,
                  {
                    id: assistantId,
                    role: 'assistant' as const,
                    content: chunk.content,
                    statusText: undefined,
                  } as DisplayMessage,
                ];
            latestMessagesRef.current = next;
            setConversation((prev) =>
              prev?.id === workingConversation.id
                ? { ...prev, messages: next }
                : prev
            );
          } else if (chunk.type === 'chart') {
            hasRealContent = true;
            try {
              const chartData = JSON.parse(chunk.content);
              const base = latestMessagesRef.current;
              const existing = base.find((m) => m.id === assistantId);
              const next = existing
                ? base.map((m) =>
                    m.id === assistantId
                      ? { ...m, chartData, statusText: undefined }
                      : m
                  )
                : [
                    ...base,
                    {
                      id: assistantId,
                      role: 'assistant' as const,
                      content: '',
                      chartData,
                      statusText: undefined,
                    } as DisplayMessage,
                  ];
              latestMessagesRef.current = next;
              setConversation((prev) =>
                prev?.id === workingConversation.id
                  ? { ...prev, messages: next }
                  : prev
              );
            } catch {
              // ignore
            }
          } else if (chunk.type === 'tool_call' && chunk.toolCall) {
            // Tool call: remove assistant placeholder (no chat trace for tool interactions)
            const base = latestMessagesRef.current.filter(
              (m) => m.id !== assistantId
            );
            latestMessagesRef.current = base;
            setConversation((prev) =>
              prev?.id === workingConversation.id
                ? { ...prev, messages: base }
                : prev
            );

            historyRef.current = buildHistory(base);
            setActiveToolCall({ toolCall: chunk.toolCall });
            return;
          } else if (chunk.type === 'error') {
            const base = latestMessagesRef.current.filter(
              (m) => m.id !== assistantId
            );
            const next = [
              ...base,
              {
                id: crypto.randomUUID(),
                role: 'error' as const,
                content: chunk.content,
              } as DisplayMessage,
            ];
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
          // user aborted
        } else {
          const base = latestMessagesRef.current.filter(
            (m) => m.id !== assistantId
          );
          const next = [
            ...base,
            {
              id: crypto.randomUUID(),
              role: 'error' as const,
              content:
                error instanceof Error ? error.message : '发送失败，请重试',
            } as DisplayMessage,
          ];
          latestMessagesRef.current = next;
          setConversation((prev) =>
            prev?.id === workingConversation.id
              ? { ...prev, messages: next }
              : prev
          );
        }
      } finally {
        // If assistant has no real content, remove it
        const finalMessages = hasRealContent
          ? latestMessagesRef.current
          : latestMessagesRef.current.filter((m) => m.id !== assistantId);
        latestMessagesRef.current = finalMessages;
        setConversation((prev) =>
          prev?.id === workingConversation.id
            ? {
                ...prev,
                messages: finalMessages,
                updatedAt: Date.now(),
                loading: false,
              }
            : prev
        );

        if (workingConversation.serverId) {
          await persistAfterStream({
            ...workingConversation,
            messages: finalMessages,
            updatedAt: Date.now(),
            loading: false,
          });
        } else {
          syncConversationToCache({
            ...workingConversation,
            messages: finalMessages,
            updatedAt: Date.now(),
            loading: false,
          });
        }

        abortControllerRef.current = null;
        setIsLoading(false);
      }
    },
    [persistAfterStream, syncConversationToCache, setConversation]
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
      ];

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
          // 后端会话创建失败时降级为本地会话
        }
      }

      const history = buildHistory(workingConversation.messages);
      historyRef.current = history;

      try {
        const stream = manifestChatWithAgent(trimmed, history, orgId, {
          conversationId:
            workingConversation.serverId || workingConversation.id,
          signal: abortControllerRef.current?.signal,
        });

        await processStream(stream, workingConversation, initialMessages);
      } catch (error) {
        console.log(error);

        // Handled in processStream
      }
    },
    [conversation, isLoading, orgId, processStream, onConversationCreate]
  );

  const submitToolResult = useCallback(
    async (result: Record<string, unknown>) => {
      if (isLoading || !conversation || !activeToolCall) return;

      setActiveToolCall(null);
      setIsLoading(true);
      abortControllerRef.current = new AbortController();

      const workingConversation = { ...conversation, loading: true };
      setConversation(workingConversation);

      const initialMessages: DisplayMessage[] = [
        ...workingConversation.messages,
      ];

      try {
        const stream = submitToolResultApi(
          result,
          historyRef.current,
          orgId,
          {
            conversationId:
              workingConversation.serverId || workingConversation.id,
            signal: abortControllerRef.current?.signal,
          },
          activeToolCall.toolCall
        );

        await processStream(stream, workingConversation, initialMessages);
      } catch (error) {
        console.log(error);

        // Handled in processStream
      }
    },
    [activeToolCall, conversation, isLoading, orgId, processStream]
  );

  const cancelToolCall = useCallback(() => {
    setActiveToolCall(null);
  }, []);

  return {
    sendMessage,
    submitToolResult,
    cancelToolCall,
    activeToolCall,
    isLoading,
    abort,
  };
}
