/** AI 助手接口类型（与 apps/api/src/ai 对齐） */

export type AiModel = {
  id: string;
  displayName: string;
  tags: string[];
};

export type Conversation = {
  id: string;
  title?: string | null;
  modelId: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
};

export type AiMessageRole = 'SYSTEM' | 'USER' | 'ASSISTANT' | 'TOOL';

/** 历史消息记录：content 结构随 role 不同（见 apps/api/src/ai/storage/messages.ts） */
export type AiMessageRecord = {
  id: string;
  role: AiMessageRole;
  content: unknown;
  modelId?: string | null;
  tokensInput?: number | null;
  tokensOutput?: number | null;
  createdAt: string;
};

export type ToolCallRecord = {
  id?: string;
  name?: string;
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

export type PendingActionStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'EXPIRED';

/** 历史回放用的待确认操作记录（含已处理终态） */
export type PendingAction = PendingActionEvent & {
  input?: unknown;
  status: PendingActionStatus;
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
