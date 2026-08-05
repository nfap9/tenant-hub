import type { BaseMessage } from '@langchain/core/messages';
import {
  listPendingActions,
  type PendingActionRecord,
} from '../storage/pendingActionRecords.js';
import { getGraph } from './graph.js';
import {
  serializeMessage,
  type PendingActionPayload,
  type SerializedMessage,
} from './events.js';

/** 会话完整状态：消息历史 + 当前待处理的 interrupt + 待确认操作审计记录（含终态，供前端回放卡片） */
export interface ConversationState {
  messages: SerializedMessage[];
  interrupts: PendingActionPayload[];
  actions: PendingActionRecord[];
}

export const getConversationState = async (
  conversationId: string
): Promise<ConversationState> => {
  const graph = await getGraph();
  const state = await graph.getState({
    configurable: { thread_id: conversationId },
  });
  const values = state.values as { messages?: BaseMessage[] };
  const messages = (values.messages ?? []).map(serializeMessage);
  const interrupts = state.tasks.flatMap((t) =>
    (t.interrupts ?? []).map((i) => i.value as PendingActionPayload)
  );
  const actions = await listPendingActions(conversationId);
  return { messages, interrupts, actions };
};
