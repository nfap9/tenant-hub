import type { PendingActionEvent } from '@/api/ai';

export type PendingState =
  | 'pending'
  | 'confirming'
  | 'confirmed'
  | 'rejected'
  | 'expired';

export type ChatToolCall = {
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
};
