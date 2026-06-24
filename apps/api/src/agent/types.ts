import type { FormField } from './schema-to-form.js';

export interface StreamChunk {
  type: 'status' | 'message' | 'done' | 'error' | 'chart' | 'form' | 'action';
  content: string;
  form?: {
    tool: string;
    reason: string;
    fields: FormField[];
  };
  action?: {
    tool: string;
    method: string;
    path: string;
    params: Record<string, unknown>;
    summary: string;
    impact: string[];
    requiresConfirmation: boolean;
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
