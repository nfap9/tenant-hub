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

/** LangGraph 图状态中的序列化消息（GET state / SSE message 事件） */
export type SerializedMessage = {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  /** assistant 消息携带的工具调用记录 */
  toolCalls?: { id: string; name: string; args: Record<string, unknown> }[];
  /** tool 消息对应的工具调用 id */
  toolCallId?: string;
  /** tool 消息的工具名 */
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

/** interrupt 产生的待确认操作 */
export type PendingActionPayload = {
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

/** 审计表全量记录（含已处理终态），历史回放用 */
export type PendingActionRecord = PendingActionPayload & {
  input?: unknown;
  status: AiPendingActionStatus;
  createdAt: string;
};

/** GET /conversations/:id/state 的响应 */
export type AiConversationState = {
  messages: SerializedMessage[];
  /** 当前仍可操作的待确认操作 */
  interrupts: PendingActionPayload[];
  /** 审计表全量记录（含终态） */
  actions: PendingActionRecord[];
};

export type AgentEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'message'; message: SerializedMessage }
  | { type: 'tool_call'; name: string; summary: string }
  | { type: 'interrupt'; action: PendingActionPayload }
  | { type: 'error'; message: string }
  | { type: 'done' };
