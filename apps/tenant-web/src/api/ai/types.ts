export type AiModelOption = {
  id: string;
  displayName: string;
  tags: string[];
};

export type AiConversationSummary = {
  id: string;
  modelId: string;
  status: 'ACTIVE' | 'ARCHIVED';
  updatedAt: string;
  title?: string | null;
};

export type AiMessageRole = 'SYSTEM' | 'USER' | 'ASSISTANT' | 'TOOL';

export type AiMessageRecord = {
  id: string;
  role: AiMessageRole;
  content: unknown;
  modelId?: string | null;
  tokensInput?: number | null;
  tokensOutput?: number | null;
  createdAt: string;
};

export type ToolPreviewDiff = {
  field: string;
  oldValue?: unknown;
  newValue?: unknown;
};

export type ToolPreview = {
  title: string;
  riskLevel: 'low' | 'medium' | 'high';
  diff: ToolPreviewDiff[];
  description: string;
};

export type PendingActionEvent = {
  id: string;
  conversationId: string;
  toolCallId: string;
  toolName: string;
  summary: ToolPreview;
  expiresAt: string;
};

export type AiPendingActionStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'EXPIRED';

/** 历史回放用的待确认操作记录（含已处理终态） */
export type AiPendingActionRecord = PendingActionEvent & {
  input?: unknown;
  status: AiPendingActionStatus;
  createdAt: string;
};

export type AgentEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'assistant_message'; text: string }
  | { type: 'tool_call'; name: string; summary: string }
  | { type: 'pending_action'; action: PendingActionEvent }
  | { type: 'error'; message: string }
  | { type: 'done' };

export type ConfirmActionResult = {
  actionId: string;
  toolName: string;
  ok: boolean;
  summary: string;
  data?: unknown;
};
