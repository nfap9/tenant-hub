import type {
  AgentEvent,
  AiConversationState,
  PendingActionRecord,
  SerializedMessage,
} from '@/api/ai';
import type { ChatMessage, ChatPendingAction, PendingState } from '../types';

export const isExpired = (expiresAt: string) =>
  new Date(expiresAt).getTime() < Date.now();

const findLastIndex = (
  messages: ChatMessage[],
  predicate: (m: ChatMessage) => boolean
): number => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (predicate(messages[i])) return i;
  }
  return -1;
};

/** SerializedMessage → ChatMessage（assistant 的 toolCall 摘要留空，由 tool_call 事件补齐） */
const messageFromSerialized = (msg: SerializedMessage): ChatMessage => ({
  id: msg.id,
  role: msg.role,
  text: msg.content,
  toolCalls: msg.toolCalls?.map((tc) => ({
    id: tc.id,
    name: tc.name,
    summary: '',
  })),
  toolCallId: msg.toolCallId,
});

/**
 * 把一条完整消息快照合并进列表：
 * - user：本地乐观消息（local- 前缀）同文则升级 id，否则按 id 去重追加
 * - assistant：定稿当前流式中的 pending 消息；同 id 覆盖；否则追加
 * - tool：按 toolCallId 去重/覆盖（resume 重跑 tools 节点会重推）
 */
const upsertSerializedMessage = (
  messages: ChatMessage[],
  msg: SerializedMessage
): ChatMessage[] => {
  if (msg.role === 'tool') {
    const idx = msg.toolCallId
      ? findLastIndex(
          messages,
          (m) => m.role === 'tool' && m.toolCallId === msg.toolCallId
        )
      : -1;
    if (idx >= 0) {
      const next = [...messages];
      next[idx] = messageFromSerialized(msg);
      return next;
    }
    return [...messages, messageFromSerialized(msg)];
  }

  const existing = findLastIndex(messages, (m) => m.id === msg.id);
  if (existing >= 0) {
    const next = [...messages];
    next[existing] = { ...messageFromSerialized(msg), pending: false };
    return next;
  }

  if (msg.role === 'assistant') {
    const pendingIdx = findLastIndex(
      messages,
      (m) => m.role === 'assistant' && Boolean(m.pending)
    );
    if (pendingIdx >= 0) {
      const next = [...messages];
      next[pendingIdx] = { ...messageFromSerialized(msg), pending: false };
      return next;
    }
  }

  if (msg.role === 'user') {
    const localIdx = findLastIndex(
      messages,
      (m) =>
        m.role === 'user' && m.id.startsWith('local-') && m.text === msg.content
    );
    if (localIdx >= 0) {
      const next = [...messages];
      next[localIdx] = messageFromSerialized(msg);
      return next;
    }
  }

  return [...messages, messageFromSerialized(msg)];
};

/** 把 interrupt 待确认操作挂到对应 assistant 消息（优先 toolCallId，兜底最后一条 assistant） */
const attachLiveAction = (
  messages: ChatMessage[],
  action: ChatPendingAction
): ChatMessage[] => {
  let idx = findLastIndex(messages, (m) =>
    Boolean(m.toolCalls?.some((tc) => tc.id && tc.id === action.toolCallId))
  );
  if (idx < 0) {
    idx = findLastIndex(messages, (m) =>
      Boolean(m.toolCalls?.some((tc) => tc.name === action.toolName))
    );
  }
  if (idx < 0) {
    idx = findLastIndex(messages, (m) => m.role === 'assistant');
  }
  if (idx < 0) return messages;
  const next = [...messages];
  next[idx] = {
    ...next[idx],
    pendingActions: [...(next[idx].pendingActions ?? []), action],
  };
  return next;
};

/**
 * 把一个 SSE AgentEvent 应用到消息列表（chat 与 resume 流共用）。
 * 流式目标始终是「最后一条 pending 的 assistant 消息」，由 message 事件定稿；
 * 后续 text_delta 自动开启新的流式消息，从而支持一次 chat 产出多条 assistant 消息。
 * 纯函数：仅返回新的消息列表，toast 等副作用由调用方处理。
 */
export const applyAgentEventToMessages = (
  messages: ChatMessage[],
  event: AgentEvent
): ChatMessage[] => {
  switch (event.type) {
    case 'text_delta': {
      const idx = findLastIndex(
        messages,
        (m) => m.role === 'assistant' && Boolean(m.pending)
      );
      if (idx >= 0) {
        const next = [...messages];
        next[idx] = { ...next[idx], text: next[idx].text + event.delta };
        return next;
      }
      return [
        ...messages,
        {
          id: `stream-${Date.now()}`,
          role: 'assistant',
          text: event.delta,
          pending: true,
        },
      ];
    }
    case 'message':
      return upsertSerializedMessage(messages, event.message);
    case 'tool_call': {
      const idx = findLastIndex(messages, (m) => m.role === 'assistant');
      if (idx < 0) return messages;
      const target = messages[idx];
      const toolCalls = [...(target.toolCalls ?? [])];
      // 既有合并逻辑：同 name 且摘要为空的工具调用直接补摘要（重推时不会产生重复条目）
      const pendingIdx = toolCalls.findIndex(
        (tc) => tc.name === event.name && !tc.summary
      );
      if (pendingIdx >= 0) {
        toolCalls[pendingIdx] = {
          ...toolCalls[pendingIdx],
          summary: event.summary,
        };
      } else {
        toolCalls.push({ name: event.name, summary: event.summary });
      }
      const next = [...messages];
      next[idx] = { ...target, toolCalls };
      return next;
    }
    case 'interrupt': {
      const expired = isExpired(event.action.expiresAt);
      const action: ChatPendingAction = {
        ...event.action,
        actionable: !expired,
        state: expired ? 'expired' : 'pending',
      };
      return attachLiveAction(messages, action);
    }
    case 'error': {
      const idx = findLastIndex(
        messages,
        (m) => m.role === 'assistant' && Boolean(m.pending)
      );
      if (idx >= 0) {
        const next = [...messages];
        next[idx] = {
          ...next[idx],
          pending: false,
          error: true,
          text: next[idx].text || event.message,
        };
        return next;
      }
      return [
        ...messages,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          text: event.message,
          error: true,
        },
      ];
    }
    case 'done':
      return messages.map((m) => (m.pending ? { ...m, pending: false } : m));
    default:
      return messages;
  }
};

const stateFromRecord = (
  record: PendingActionRecord,
  actionable: boolean
): PendingState => {
  if (actionable) return 'pending';
  switch (record.status) {
    case 'CONFIRMED':
      return 'confirmed';
    case 'REJECTED':
      return 'rejected';
    default:
      // PENDING 但不在 interrupts 中，视为已不可操作
      return 'expired';
  }
};

/**
 * 把待确认操作审计记录归位到对应助手消息：
 * 优先按 toolCallId 匹配消息里的 toolCalls，
 * 其次按 toolName，最后兜底到该操作创建前最近的助手消息。
 * 只有 interrupts 中且未过期的操作可交互，其余按 status 展示终态。
 */
export const attachPendingActions = (
  messages: ChatMessage[],
  records: PendingActionRecord[],
  interrupts: { id: string }[]
): ChatMessage[] => {
  const actionableIds = new Set(interrupts.map((i) => i.id));
  const result = messages.map((m) => ({ ...m }));
  for (const record of records) {
    let idx = findLastIndex(result, (m) =>
      Boolean(m.toolCalls?.some((tc) => tc.id && tc.id === record.toolCallId))
    );
    if (idx < 0) {
      idx = findLastIndex(result, (m) =>
        Boolean(m.toolCalls?.some((tc) => tc.name === record.toolName))
      );
    }
    if (idx < 0) {
      idx = findLastIndex(
        result,
        (m) =>
          m.role === 'assistant' &&
          (!m.createdAt || !record.createdAt || m.createdAt <= record.createdAt)
      );
    }
    if (idx < 0) continue;
    const actionable =
      actionableIds.has(record.id) && !isExpired(record.expiresAt);
    const action: ChatPendingAction = {
      id: record.id,
      conversationId: record.conversationId,
      toolCallId: record.toolCallId,
      toolName: record.toolName,
      summary: record.summary,
      expiresAt: record.expiresAt,
      actionable,
      state: stateFromRecord(record, actionable),
    };
    result[idx] = {
      ...result[idx],
      pendingActions: [...(result[idx].pendingActions ?? []), action],
    };
  }
  return result;
};

/** GET state → 聊天条目：tool 消息按 toolCallId 去重，审计记录归位，interrupt 标记可操作 */
export const messagesFromState = (
  state: AiConversationState
): ChatMessage[] => {
  const messages: ChatMessage[] = [];
  const toolIndexByCallId = new Map<string, number>();
  for (const msg of state.messages) {
    if (msg.role === 'tool' && msg.toolCallId) {
      const existing = toolIndexByCallId.get(msg.toolCallId);
      if (existing !== undefined) {
        messages[existing] = messageFromSerialized(msg);
        continue;
      }
      toolIndexByCallId.set(msg.toolCallId, messages.length);
    }
    messages.push(messageFromSerialized(msg));
  }
  // 历史回放没有 tool_call 事件补摘要，给空摘要一个终态文案
  for (const m of messages) {
    m.toolCalls = m.toolCalls?.map((tc) =>
      tc.summary ? tc : { ...tc, summary: `已调用 ${tc.name}` }
    );
  }
  return attachPendingActions(messages, state.actions, state.interrupts);
};

/** 更新消息列表中某个待确认操作的状态/结果 */
export const updatePendingActionInMessages = (
  messages: ChatMessage[],
  actionId: string,
  patch: Partial<ChatPendingAction>
): ChatMessage[] =>
  messages.map((m) => {
    if (!m.pendingActions) return m;
    return {
      ...m,
      pendingActions: m.pendingActions.map((a) =>
        a.id === actionId ? { ...a, ...patch } : a
      ),
    };
  });

/** SSE 连接层失败（非 Agent error 事件）时，把流式中的助手消息标记为错误 */
export const markMessageError = (
  messages: ChatMessage[],
  assistantMsgId: string,
  errorText: string
): ChatMessage[] =>
  messages.map((m) =>
    m.id === assistantMsgId
      ? { ...m, pending: false, error: true, text: m.text || errorText }
      : m
  );

/** 中止流式输出：结束所有处于 pending 状态的消息 */
export const settlePendingMessages = (messages: ChatMessage[]): ChatMessage[] =>
  messages.map((m) =>
    m.pending ? { ...m, pending: false, text: m.text || '已中止' } : m
  );
