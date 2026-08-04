import { create } from 'zustand';
import {
  archiveConversation,
  createConversation,
  getConversationState,
  listConversations,
  listModels,
} from '@/api/ai/rest';
import { streamAiChat, streamAiResume } from '@/api/ai/stream';
import { useSessionStore } from '@/store/sessionStore';
import type {
  AgentEvent,
  AiModel,
  Conversation,
  PendingActionRecord,
  SerializedMessage,
} from '@/api/ai/types';

/** UI 侧的待确认操作：在后端记录基础上附带确认执行的结果摘要 */
export type UiPendingAction = PendingActionRecord & { resultSummary?: string };

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

/** 操作是否仍可处理：id 在后端返回的 interrupt 集合中（替代旧的 status/过期判断） */
export const isActionPending = (a: UiPendingAction, interruptIds: string[]) =>
  interruptIds.includes(a.id);

const truncate = (s: string, max = 160) =>
  s.length > max ? `${s.slice(0, max)}…` : s;

/** 序列化消息 → 聊天条目（assistant 的 toolCalls 与 tool 消息渲染为小字工具记录） */
const itemsFromMessage = (record: SerializedMessage): ChatItem[] => {
  if (record.role === 'user') {
    return [
      {
        kind: 'message',
        id: record.id || uid(),
        role: 'user',
        content: record.content,
      },
    ];
  }
  if (record.role === 'assistant') {
    const items: ChatItem[] = [];
    if (record.content) {
      items.push({
        kind: 'message',
        id: record.id || uid(),
        role: 'assistant',
        content: record.content,
      });
    }
    (record.toolCalls ?? []).forEach((tc, i) => {
      items.push({
        kind: 'tool',
        id: `${record.id}-tc-${i}`,
        name: tc.name,
        summary: `已调用 ${tc.name}`,
      });
    });
    return items;
  }
  // role === 'tool'
  return [
    {
      kind: 'tool',
      id: record.id || uid(),
      name: record.name ?? 'tool',
      summary: truncate(record.content),
    },
  ];
};

type ChatState = {
  ready: boolean;
  sending: boolean;
  conversations: Conversation[];
  conversationId: string | null;
  items: ChatItem[];
  pendingActions: Record<string, UiPendingAction>;
  /** 当前仍可操作的待确认操作 id（后端 state.interrupts） */
  interruptIds: string[];
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
/** 当前流式助手气泡 id；text_delta 归属它，message 事件定稿后清空 */
let currentAssistantId: string | null = null;

const initialState = {
  ready: false,
  sending: false,
  conversations: [] as Conversation[],
  conversationId: null as string | null,
  items: [] as ChatItem[],
  pendingActions: {} as Record<string, UiPendingAction>,
  interruptIds: [] as string[],
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

  /** 没有流式气泡时补一个（resume 流出的 text_delta / error 用） */
  const ensureAssistantBubble = () => {
    if (!currentAssistantId) {
      currentAssistantId = uid();
      const id = currentAssistantId;
      set((s) => ({
        items: [
          ...s.items,
          {
            kind: 'message',
            id,
            role: 'assistant',
            content: '',
            streaming: true,
          },
        ],
      }));
    }
    return currentAssistantId;
  };

  /** 流结束：定稿流式气泡；空气泡（纯工具/中断运行）直接移除 */
  const finalizeAssistant = () => {
    const id = currentAssistantId;
    currentAssistantId = null;
    if (!id) return;
    set((s) => ({
      items: s.items.flatMap((it) =>
        it.kind === 'message' && it.id === id
          ? it.content || it.error
            ? [{ ...it, streaming: false }]
            : []
          : [it]
      ),
    }));
  };

  /** 追加工具记录，按 id 去重（interrupt 恢复后 tools 节点重跑会重复产出同一 toolCallId 的事件） */
  const appendToolItems = (
    toolItems: Extract<ChatItem, { kind: 'tool' }>[]
  ) => {
    if (toolItems.length === 0) return;
    set((s) => {
      const existing = new Set(
        s.items.filter((it) => it.kind === 'tool').map((it) => it.id)
      );
      const fresh = toolItems.filter((it) => !existing.has(it.id));
      return fresh.length ? { items: [...s.items, ...fresh] } : s;
    });
  };

  const refreshConversations = async () => {
    try {
      const conversations = await listConversations();
      set({ conversations });
    } catch {
      // 列表刷新失败不打断对话
    }
  };

  /** 拉取会话完整状态并重建时间线（打开会话回放 / resume 结束后全量刷新） */
  const loadState = async (id: string) => {
    const state = await getConversationState(id);

    // 消息按序展开；操作卡片锚定到对应 toolCall 的消息之后（SerializedMessage 无时间戳，
    // 无法与 actions.createdAt 直接交错排序），无法锚定的追加到末尾
    const items: ChatItem[] = [];
    const placed = new Set<string>();
    for (const m of state.messages) {
      items.push(...itemsFromMessage(m));
      const callIds = new Set<string>();
      if (m.role === 'assistant') {
        m.toolCalls?.forEach((tc) => tc.id && callIds.add(tc.id));
      }
      if (m.role === 'tool' && m.toolCallId) callIds.add(m.toolCallId);
      for (const a of state.actions) {
        if (!placed.has(a.id) && callIds.has(a.toolCallId)) {
          placed.add(a.id);
          items.push({ kind: 'action', id: `action-${a.id}`, actionId: a.id });
        }
      }
    }
    for (const a of state.actions) {
      if (!placed.has(a.id)) {
        items.push({ kind: 'action', id: `action-${a.id}`, actionId: a.id });
      }
    }

    const toolMsgByCallId = new Map(
      state.messages
        .filter((m) => m.role === 'tool' && m.toolCallId)
        .map((m) => [m.toolCallId as string, m])
    );
    const map: Record<string, UiPendingAction> = {};
    for (const a of state.actions) {
      const toolMsg = toolMsgByCallId.get(a.toolCallId);
      map[a.id] = {
        ...a,
        resultSummary:
          a.status === 'CONFIRMED' && toolMsg
            ? truncate(toolMsg.content)
            : undefined,
      };
    }
    // interrupt 中可能还有尚未落审计记录的载荷，补齐为 PENDING 卡片数据
    const interruptIds: string[] = [];
    for (const p of state.interrupts) {
      interruptIds.push(p.id);
      if (!map[p.id]) {
        map[p.id] = { ...p, status: 'PENDING', createdAt: p.expiresAt };
      }
    }
    set({ items, pendingActions: map, interruptIds });
  };

  /** chat 与 resume 共用的事件处理：resume 后图继续执行，协议一致 */
  const applyEvent = (event: AgentEvent) => {
    switch (event.type) {
      case 'text_delta': {
        const id = ensureAssistantBubble();
        patchAssistant(id, (m) => ({ content: m.content + event.delta }));
        break;
      }
      case 'message': {
        const msg = event.message;
        if (msg.role === 'user') break; // 用户消息本地已回显
        if (msg.role === 'assistant') {
          if (msg.content) {
            if (currentAssistantId) {
              // 定稿当前流式气泡；后续 text_delta 会落到新气泡
              const id = currentAssistantId;
              currentAssistantId = null;
              patchAssistant(id, () => ({
                content: msg.content,
                streaming: false,
              }));
            } else {
              set((s) => ({
                items: [
                  ...s.items,
                  {
                    kind: 'message',
                    id: msg.id || uid(),
                    role: 'assistant',
                    content: msg.content,
                  },
                ],
              }));
            }
          }
          // 空文本 + toolCalls 的消息渲染为工具调用记录
          appendToolItems(
            (msg.toolCalls ?? []).map((tc, i) => ({
              kind: 'tool' as const,
              id: tc.id ? `tc-${tc.id}` : `${msg.id}-tc-${i}`,
              name: tc.name,
              summary: `已调用 ${tc.name}`,
            }))
          );
          break;
        }
        // role === 'tool'：与 assistant toolCalls 记录共用 tc- 前缀去重
        appendToolItems([
          {
            kind: 'tool',
            id: msg.toolCallId ? `tc-${msg.toolCallId}` : `tm-${msg.id}`,
            name: msg.name ?? 'tool',
            summary: truncate(msg.content),
          },
        ]);
        break;
      }
      case 'tool_call':
        // 无 toolCallId 可去重，按 名称+内容 去重（resume 重跑会原样重发）
        appendToolItems([
          {
            kind: 'tool',
            id: `tcall-${event.name}-${event.summary}`,
            name: event.name,
            summary: event.summary,
          },
        ]);
        break;
      case 'interrupt':
        set((s) => {
          const existing = s.pendingActions[event.action.id];
          const hasCard = s.items.some(
            (it) => it.kind === 'action' && it.actionId === event.action.id
          );
          return {
            pendingActions: {
              ...s.pendingActions,
              [event.action.id]: {
                ...existing,
                ...event.action,
                status: existing?.status ?? 'PENDING',
                createdAt: existing?.createdAt ?? new Date().toISOString(),
              },
            },
            interruptIds: s.interruptIds.includes(event.action.id)
              ? s.interruptIds
              : [...s.interruptIds, event.action.id],
            items: hasCard
              ? s.items
              : [
                  ...s.items,
                  {
                    kind: 'action',
                    id: `action-${event.action.id}`,
                    actionId: event.action.id,
                  },
                ],
          };
        });
        break;
      case 'error': {
        const id = ensureAssistantBubble();
        patchAssistant(id, (m) => ({
          streaming: false,
          error: true,
          content: m.content || event.message,
        }));
        currentAssistantId = null;
        break;
      }
      case 'done':
        finalizeAssistant();
        break;
    }
  };

  /** 确认/拒绝待确认操作：走 resume SSE，事件继续渲染进当前会话 */
  const resume = (actionId: string, decision: 'approve' | 'reject') => {
    const conversationId = get().conversationId;
    if (
      !conversationId ||
      get().sending ||
      !get().interruptIds.includes(actionId)
    ) {
      return;
    }
    set({ sending: true });

    abortController = streamAiResume({
      conversationId,
      actionId,
      decision,
      onEvent: applyEvent,
      onError: (err) => {
        set((s) => ({
          sending: false,
          items: [
            ...s.items,
            {
              kind: 'message',
              id: uid(),
              role: 'assistant',
              error: true,
              content: err.message,
            },
          ],
        }));
      },
      onClose: () => {
        abortController = null;
        finalizeAssistant();
        set({ sending: false });
        // 流结束后全量刷新会话状态，保证卡片终态与后端一致
        if (get().conversationId === conversationId) {
          loadState(conversationId).catch(() => undefined);
        }
        void refreshConversations();
      },
    });
  };

  return {
    ...initialState,

    reset: () => {
      abortController?.abort();
      abortController = null;
      currentAssistantId = null;
      set({ ...initialState });
    },

    init: async () => {
      // 每次初始化先清空上一组织/上一会话残留的数据
      abortController?.abort();
      abortController = null;
      currentAssistantId = null;
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
      currentAssistantId = null;
      set({
        conversationId: id,
        items: [],
        pendingActions: {},
        interruptIds: [],
        ready: false,
      });
      try {
        await loadState(id);
      } catch {
        set({ items: [], pendingActions: {}, interruptIds: [] });
      } finally {
        set({ ready: true });
      }
    },

    newConversation: () => {
      get().stop();
      currentAssistantId = null;
      // 不立即 POST 创建：等首次 send 时再真正建会话
      set({
        conversationId: null,
        items: [],
        pendingActions: {},
        interruptIds: [],
      });
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
      currentAssistantId = assistantId;
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
        onEvent: applyEvent,
        onError: (err) => {
          finalizeAssistant();
          set((s) => ({
            sending: false,
            items: [
              ...s.items,
              {
                kind: 'message',
                id: uid(),
                role: 'assistant',
                error: true,
                content: err.message,
              },
            ],
          }));
        },
        onClose: () => {
          abortController = null;
          finalizeAssistant();
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
      resume(actionId, 'approve');
    },

    reject: async (actionId) => {
      resume(actionId, 'reject');
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
