import type { ToolPreview } from '../tools/index.js';

export interface AgentContext {
  organizationId: string;
  userId: string;
  permissions: string[];
  orgName: string;
  username: string;
  roleName: string;
}

export interface PendingActionEvent {
  id: string;
  conversationId: string;
  toolCallId: string;
  toolName: string;
  summary: ToolPreview;
  expiresAt: string;
}

export type AgentEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'assistant_message'; text: string }
  | { type: 'tool_call'; name: string; summary: string }
  | { type: 'pending_action'; action: PendingActionEvent }
  | { type: 'error'; message: string }
  | { type: 'done' };

export interface RunAgentParams {
  conversationId: string;
  organizationId: string;
  userId: string;
  userMessage: string;
  modelId?: string;
  ctx: AgentContext;
  onEvent: (e: AgentEvent) => void;
  signal?: AbortSignal;
}
