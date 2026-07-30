import type {
  AgentEvent,
  AiMessageRecord,
  AiPendingActionRecord,
} from '@/api/ai';
import type { ChatMessage, ChatPendingAction, PendingState } from '../types';

export const isExpired = (expiresAt: string) =>
  new Date(expiresAt).getTime() < Date.now();

export const messageFromRecord = (record: AiMessageRecord): ChatMessage => {
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
export const attachPendingActions = (
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

/**
 * 把一个 SSE AgentEvent 应用到消息列表（以流式中的助手消息为作用目标）。
 * 纯函数：仅返回新的消息列表，toast 等副作用由调用方处理。
 */
export const applyAgentEventToMessages = (
  messages: ChatMessage[],
  event: AgentEvent,
  assistantMsgId: string
): ChatMessage[] => {
  const updateAssistant = (fn: (m: ChatMessage) => ChatMessage) =>
    messages.map((m) => (m.id === assistantMsgId ? fn(m) : m));

  switch (event.type) {
    case 'text_delta':
      return updateAssistant((m) => ({ ...m, text: m.text + event.delta }));
    case 'assistant_message':
      return updateAssistant((m) => ({
        ...m,
        text: event.text,
        pending: false,
      }));
    case 'tool_call':
      return updateAssistant((m) => {
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
      });
    case 'pending_action': {
      const pending: ChatPendingAction = {
        ...event.action,
        state: isExpired(event.action.expiresAt) ? 'expired' : 'pending',
      };
      return updateAssistant((m) => ({
        ...m,
        pendingActions: [...(m.pendingActions ?? []), pending],
      }));
    }
    case 'error':
      return updateAssistant((m) => ({
        ...m,
        pending: false,
        error: true,
        text: m.text || event.message,
      }));
    case 'done':
      return updateAssistant((m) => ({ ...m, pending: false }));
    default:
      return messages;
  }
};

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
