import { create } from 'zustand';
import {
  archiveConversation,
  confirmAction,
  createConversation,
  listConversations,
  listMessages,
  listModels,
  listPendingActions,
  rejectAction,
} from '@/api/ai/rest';
import { streamAiChat } from '@/api/ai/stream';
import { useSessionStore } from '@/store/sessionStore';
import type {
  AgentEvent,
  AiMessageRecord,
  AiModel,
  Conversation,
  PendingAction,
  ToolCallRecord,
} from '@/api/ai/types';

/** UI 侧的待确认操作：在后端记录基础上附带确认执行的结果摘要 */
export type UiPendingAction = PendingAction & { resultSummary?: string };

export type ChatItem =
  | {
      kind: 'message';
      id: string;
      role: 'user' | 'assistant';
      content: string;
      streaming?: boolean;
      error?: boolean;
    }
  | { kind: 'tool'; id: string; name: string; summary: string }
  | { kind: 'action'; id: string; actionId: string };

let localSeq = 0;
const uid = () => `local-${Date.now()}-${(localSeq += 1)}`;

export const isActionExpired = (a: { expiresAt: string }) =>
  new Date(a.expiresAt).getTime() < Date.now();

/** 操作是否仍处于待处理（PENDING 且未过期） */
export const isActionPending = (a: UiPendingAction) =>
  a.status === 'PENDING' && !isActionExpired(a);

const truncate = (s: string, max = 160) =>
  s.length > max ? `${s.slice(0, max)}…` : s;

/** 历史消息记录 → 聊天条目（ASSISTANT 的 toolCalls 与 TOOL 消息渲染为小字工具记录） */
const itemsFromMessage = (record: AiMessageRecord): ChatItem[] => {
  if (record.role === 'USER') {
    return [
      {
        kind: 'message',
        id: record.id,
        role: 'user',
        content: typeof record.content === 'string' ? record.content : '',
      },
    ];
  }
  if (record.role === 'ASSISTANT') {
    let text = '';
    let toolCalls: ToolCallRecord[] = [];
    if (typeof record.content === 'string') {
      text = record.content;
    } else if (record.content && typeof record.content === 'object') {
      const obj = record.content as {
        text?: string;
        toolCalls?: ToolCallRecord[];
      };
      text = obj.text ?? '';
      toolCalls = obj.toolCalls ?? [];
    }
    const items: ChatItem[] = [
      { kind: 'message', id: record.id, role: 'assistant', content: text },
    ];
    toolCalls.forEach((tc, i) => {
      const name = tc?.name ?? `tool-${i}`;
      items.push({
        kind: 'tool',
        id: `${record.id}-tc-${i}`,
        name,
        summary: `已调用 ${name}`,
      });
    });
    return items;
  }
  if (record.role === 'TOOL') {
    const obj = (record.content ?? {}) as { content?: string };
    return [
      {
        kind: 'tool',
        id: record.id,
        name: 'tool',
        summary: truncate(obj.content ?? ''),
      },
    ];
  }
  return [];
};

type ChatState = {
  ready: boolean;
  sending: boolean;
  conversations: Conversation[];
  conversationId: string | null;
  items: ChatItem[];
  pendingActions: Record<string, UiPendingAction>;
  models: AiModel[];
  selectedModelId: string | null;
  init: () => Promise<void>;
  openConversation: (id: string) => Promise<void>;
  newConversation: () => void;
  send: (text: string) => Promise<void>;
  stop: () => void;
  confirm: (actionId: string) => Promise<void>;
  reject: (actionId: string) => Promise<void>;
  archive: (id: string) => Promise<void>;
  selectModel: (id: string) => void;
  /** 清空全部聊天数据（切换组织/退出登录时调用，保证组织间数据隔离） */
  reset: () => void;
};

/** 进行中的 SSE 请求控制器（不放进 state，避免触发渲染） */
let abortController: AbortController | null = null;

const initialState = {
  ready: false,
  sending: false,
  conversations: [] as Conversation[],
  conversationId: null as string | null,
  items: [] as ChatItem[],
  pendingActions: {} as Record<string, UiPendingAction>,
  models: [] as AiModel[],
  selectedModelId: null as string | null,
};

export const useChatStore = create<ChatState>((set, get) => {
  /** 更新流式中的助手气泡 */
  const patchAssistant = (
    assistantId: string,
    fn: (m: Extract<ChatItem, { kind: 'message' }>) => Partial<typeof m>
  ) =>
    set((s) => ({
      items: s.items.map((it) =>
        it.kind === 'message' && it.id === assistantId
          ? { ...it, ...fn(it) }
          : it
      ),
    }));

  const refreshConversations = async () => {
    try {
      const conversations = await listConversations();
      set({ conversations });
    } catch {
      // 列表刷新失败不打断对话
    }
  };

  const applyEvent = (event: AgentEvent, assistantId: string) => {
    switch (event.type) {
      case 'text_delta':
        patchAssistant(assistantId, (m) => ({
          content: m.content + event.delta,
        }));
        break;
      case 'assistant_message':
        patchAssistant(assistantId, () => ({
          content: event.text,
          streaming: false,
        }));
        break;
      case 'tool_call':
        set((s) => ({
          items: [
            ...s.items,
            {
              kind: 'tool',
              id: uid(),
              name: event.name,
              summary: event.summary,
            },
          ],
        }));
        break;
      case 'pending_action':
        set((s) => ({
          pendingActions: {
            ...s.pendingActions,
            [event.action.id]: {
              ...event.action,
              status: 'PENDING',
              createdAt: new Date().toISOString(),
            },
          },
          items: [
            ...s.items,
            { kind: 'action', id: uid(), actionId: event.action.id },
          ],
        }));
        break;
      case 'error':
        patchAssistant(assistantId, (m) => ({
          streaming: false,
          error: true,
          content: m.content || event.message,
        }));
        break;
      case 'done':
        patchAssistant(assistantId, () => ({ streaming: false }));
        break;
    }
  };

  return {
    ...initialState,

    reset: () => {
      abortController?.abort();
      abortController = null;
      set({ ...initialState });
    },

    init: async () => {
      // 每次初始化先清空上一组织/上一会话残留的数据
      abortController?.abort();
      abortController = null;
      set({ ...initialState });
      try {
        const [models, conversations] = await Promise.all([
          listModels(),
          listConversations(),
        ]);
        set({
          models,
          conversations,
          selectedModelId: get().selectedModelId ?? models[0]?.id ?? null,
        });
        if (conversations.length > 0) {
          await get().openConversation(conversations[0].id);
        }
      } catch {
        // 接口失败（如 AI 未启用）：停留在欢迎页，发送时再报错
      } finally {
        set({ ready: true });
      }
    },

    openConversation: async (id) => {
      get().stop();
      set({ conversationId: id, items: [], pendingActions: {}, ready: false });
      try {
        const [messages, actions] = await Promise.all([
          listMessages(id),
          listPendingActions(id),
        ]);
        // 消息与操作卡片按时间交错回放；PENDING 卡片同时进入固定面板
        const timed: { at: string; item: ChatItem }[] = [];
        for (const m of messages) {
          for (const item of itemsFromMessage(m)) {
            timed.push({ at: m.createdAt, item });
          }
        }
        const map: Record<string, UiPendingAction> = {};
        for (const a of actions) {
          map[a.id] = a;
          timed.push({
            at: a.createdAt,
            item: { kind: 'action', id: `action-${a.id}`, actionId: a.id },
          });
        }
        timed.sort((x, y) => x.at.localeCompare(y.at));
        set({ items: timed.map((t) => t.item), pendingActions: map });
      } catch {
        set({ items: [], pendingActions: {} });
      } finally {
        set({ ready: true });
      }
    },

    newConversation: () => {
      get().stop();
      // 不立即 POST 创建：等首次 send 时再真正建会话
      set({ conversationId: null, items: [], pendingActions: {} });
    },

    send: async (text) => {
      const message = text.trim();
      if (!message || get().sending) return;
      set({ sending: true });

      let conversationId = get().conversationId;
      if (!conversationId) {
        try {
          const conv = await createConversation(
            get().selectedModelId ?? undefined
          );
          conversationId = conv.id;
          set({ conversationId: conv.id });
        } catch (err) {
          set((s) => ({
            sending: false,
            items: [
              ...s.items,
              { kind: 'message', id: uid(), role: 'user', content: message },
              {
                kind: 'message',
                id: uid(),
                role: 'assistant',
                error: true,
                content:
                  err instanceof Error ? err.message : '创建会话失败，请重试',
              },
            ],
          }));
          return;
        }
      }

      const assistantId = uid();
      set((s) => ({
        items: [
          ...s.items,
          { kind: 'message', id: uid(), role: 'user', content: message },
          {
            kind: 'message',
            id: assistantId,
            role: 'assistant',
            content: '',
            streaming: true,
          },
        ],
      }));

      abortController = streamAiChat({
        conversationId,
        message,
        modelId: get().selectedModelId ?? undefined,
        onEvent: (event) => applyEvent(event, assistantId),
        onError: (err) => {
          patchAssistant(assistantId, (m) => ({
            streaming: false,
            error: true,
            content: m.content || err.message,
          }));
          set({ sending: false });
        },
        onClose: () => {
          abortController = null;
          patchAssistant(assistantId, (m) => ({
            streaming: false,
            content: m.content || '已中止',
          }));
          set({ sending: false });
          void refreshConversations();
        },
      });
    },

    stop: () => {
      abortController?.abort();
      abortController = null;
    },

    confirm: async (actionId) => {
      const result = await confirmAction(actionId);
      set((s) => {
        const action = s.pendingActions[actionId];
        if (!action) return s;
        return {
          pendingActions: {
            ...s.pendingActions,
            [actionId]: {
              ...action,
              status: 'CONFIRMED',
              resultSummary: result.summary,
            },
          },
        };
      });
    },

    reject: async (actionId) => {
      await rejectAction(actionId);
      set((s) => {
        const action = s.pendingActions[actionId];
        if (!action) return s;
        return {
          pendingActions: {
            ...s.pendingActions,
            [actionId]: { ...action, status: 'REJECTED' },
          },
        };
      });
    },

    archive: async (id) => {
      await archiveConversation(id);
      set((s) => ({
        conversations: s.conversations.filter((c) => c.id !== id),
      }));
      if (get().conversationId === id) {
        get().newConversation();
      }
    },

    selectModel: (id) => set({ selectedModelId: id }),
  };
});

// 组织隔离：切换组织或退出登录时，立即清空上一组织的聊天数据；
// 新组织就绪后重新初始化（若聊天页重新挂载，其 useEffect 会再次 init，幂等无妨）
useSessionStore.subscribe((state, prev) => {
  const orgChanged = state.currentOrgId !== prev.currentOrgId;
  const signedOut = state.status === 'signedOut' && prev.status !== 'signedOut';
  if (!orgChanged && !signedOut) return;
  const chat = useChatStore.getState();
  chat.reset();
  if (orgChanged && state.currentOrgId && state.status === 'ready') {
    void chat.init();
  }
});
