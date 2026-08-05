import type { PendingActionPayload } from '@/api/ai';

export type PendingState =
  | 'pending'
  | 'confirming'
  | 'rejecting'
  | 'confirmed'
  | 'rejected'
  | 'expired';

export type ChatToolCall = {
  /** 后端 ToolCall 的 id，用于 pending action 归位与 tool 消息去重 */
  id?: string;
  name: string;
  summary: string;
};

export type ChatPendingAction = PendingActionPayload & {
  state: PendingState;
  /** 仅 interrupts 中仍未过期的操作可点击确认/拒绝，其余只展示终态 */
  actionable?: boolean;
  resultSummary?: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  text: string;
  toolCalls?: ChatToolCall[];
  /** tool 消息对应的工具调用 id，用于重推去重 */
  toolCallId?: string;
  pendingActions?: ChatPendingAction[];
  pending?: boolean;
  error?: boolean;
  /** 历史消息的服务端创建时间，用于 pending action 归位兜底 */
  createdAt?: string;
};
