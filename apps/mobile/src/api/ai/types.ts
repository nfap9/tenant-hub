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

/** 序列化后的会话消息（SSE message 事件与会话状态接口共用） */
export type SerializedMessage = {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: { id: string; name: string; args: Record<string, unknown> }[];
  /** role=tool 时对应的工具调用 id */
  toolCallId?: string;
  /** role=tool 时的工具名 */
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

/** 写操作待确认载荷（interrupt 事件与 graph state 中的 interrupt value） */
export type PendingActionPayload = {
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

/** 待确认操作审计记录（含已处理终态，供回放卡片） */
export type PendingActionRecord = PendingActionPayload & {
  input?: unknown;
  status: PendingActionStatus;
  createdAt: string;
};

/** GET /conversations/:id/state 返回的会话完整状态 */
export type ConversationState = {
  messages: SerializedMessage[];
  interrupts: PendingActionPayload[];
  actions: PendingActionRecord[];
};

export type AgentEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'message'; message: SerializedMessage }
  | { type: 'tool_call'; name: string; summary: string }
  | { type: 'interrupt'; action: PendingActionPayload }
  | { type: 'error'; message: string }
  | { type: 'done' };
