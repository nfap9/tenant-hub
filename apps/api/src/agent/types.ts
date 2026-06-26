import type { FormField } from './schema-to-form.js';

export interface StreamChunk {
  type: 'status' | 'message' | 'done' | 'error' | 'chart' | 'tool_call';
  content: string;
  toolCall?: {
    tool: string;
    kind: 'form' | 'confirmation';
    reason: string;
    // form kind
    fields?: FormField[];
    // confirmation kind
    method?: string;
    path?: string;
    params?: Record<string, unknown>;
    summary?: string;
    impact?: string[];
    requiresConfirmation?: boolean;
  };
}

export interface AgentContext {
  organizationId: string;
  userId: string;
  userName: string;
  permissions: string[];
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export type ToolResult =
  | { success: true; data: unknown }
  | { success: false; error: string };
