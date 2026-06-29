// AI Agent 核心类型定义

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: object;
}

export interface ChatUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export type ChatFinishReason = 'stop' | 'tool_use' | 'length' | 'error';

export interface ChatResult {
  content: string;
  toolCalls: ToolCall[];
  finishReason: ChatFinishReason;
  usage: ChatUsage;
  raw?: unknown;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  tools: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface ProviderCapabilities {
  streaming: boolean;
  toolUse: boolean;
  promptCache: boolean;
}

export interface ModelProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  chat(req: ChatRequest): Promise<ChatResult>;
}
