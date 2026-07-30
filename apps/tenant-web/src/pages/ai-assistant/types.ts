import type { PendingActionEvent } from '@/api/ai';

export type PendingState =
  | 'pending'
  | 'confirming'
  | 'confirmed'
  | 'rejected'
  | 'expired';

export type ChatToolCall = {
  /** 后端 ToolCall 的 id，用于 pending action 历史回放时归位 */
  id?: string;
  name: string;
  summary: string;
};

export type ChatPendingAction = PendingActionEvent & {
  state: PendingState;
  resultSummary?: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  text: string;
  toolCalls?: ChatToolCall[];
  pendingActions?: ChatPendingAction[];
  pending?: boolean;
  error?: boolean;
  /** 历史消息的服务端创建时间，用于 pending action 归位兜底 */
  createdAt?: string;
};
