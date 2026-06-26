import { readSession } from './client';
import { apiClient } from './client';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface FormField {
  name: string;
  type:
    | 'text'
    | 'number'
    | 'boolean'
    | 'date'
    | 'select'
    | 'array'
    | 'object'
    | 'unknown';
  label: string;
  required: boolean;
  description?: string;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string }>;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  itemType?: FormField['type'];
  fields?: FormField[];
}

export interface ToolCallChunkData {
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
}

export interface StreamChunk {
  type: 'status' | 'message' | 'done' | 'error' | 'chart' | 'tool_call';
  content: string;
  toolCall?: ToolCallChunkData;
}

export interface ChartConfig {
  chartType: 'bar' | 'line' | 'pie' | 'area' | 'radar';
  title: string;
  labels: string[];
  datasets: { label: string; data: number[] }[];
  unit?: string;
  colors?: string[];
}

export interface SavedMessage {
  id: string;
  role: 'user' | 'assistant' | 'status' | 'error';
  content: string;
  chartData?: ChartConfig;
  thinking?: string[];
}

export interface ServerConversation {
  id: string;
  title: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServerConversationDetail extends ServerConversation {
  messages: SavedMessage[];
}

export interface ChatWithAgentOptions {
  conversationId?: string;
  signal?: AbortSignal;
}

async function* streamAgent(
  endpoint: string,
  body: Record<string, unknown>,
  organizationId: string,
  signal?: AbortSignal
): AsyncGenerator<StreamChunk> {
  const API_BASE =
    import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
  const session = readSession();
  const token = session.token;

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'x-organization-id': organizationId,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    let errorText = text;
    try {
      const parsed = JSON.parse(text);
      errorText = parsed.error || text;
    } catch {
      // keep raw text
    }
    throw new Error(errorText || `请求失败 (${response.status})`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法读取响应流');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const block of lines) {
      const eventMatch = block.match(/^event: (\w+)/m);
      const dataMatch = block.match(/^data: (.+)$/m);
      if (eventMatch && dataMatch) {
        try {
          const chunk: StreamChunk = JSON.parse(dataMatch[1]);
          yield chunk;
          if (chunk.type === 'done' || chunk.type === 'error') {
            return;
          }
        } catch {
          // ignore malformed events
        }
      }
    }
  }
}

export async function* manifestChatWithAgent(
  message: string,
  history: ChatMessage[],
  organizationId: string,
  options: ChatWithAgentOptions = {}
): AsyncGenerator<StreamChunk> {
  yield* streamAgent(
    '/agent/manifest-chat',
    {
      message,
      history,
      conversationId: options.conversationId,
    },
    organizationId,
    options.signal
  );
}

export function executeAgentAction(data: {
  tool: string;
  path: string;
  params: Record<string, unknown>;
}) {
  return apiClient<unknown>('/agent/execute', {
    method: 'POST',
    body: data,
  });
}

export async function* submitToolResult(
  result: Record<string, unknown>,
  history: ChatMessage[],
  organizationId: string,
  options: ChatWithAgentOptions = {},
  kindAndTool?: { kind: 'form' | 'confirmation'; tool: string }
): AsyncGenerator<StreamChunk> {
  yield* streamAgent(
    '/agent/tool-result',
    {
      result,
      history,
      kind: kindAndTool?.kind ?? 'form',
      tool: kindAndTool?.tool,
      conversationId: options.conversationId,
    },
    organizationId,
    options.signal
  );
}

// --- 会话管理 RESTful API ---

export function getConversations(options?: {
  archived?: boolean;
  limit?: number;
  cursor?: string;
}) {
  const params = new URLSearchParams();
  if (options?.archived !== undefined)
    params.set('archived', String(options.archived));
  if (options?.limit !== undefined) params.set('limit', String(options.limit));
  if (options?.cursor) params.set('cursor', options.cursor);

  const query = params.toString();
  return apiClient<{ items: ServerConversation[]; nextCursor?: string }>(
    `/agent/conversations${query ? `?${query}` : ''}`
  );
}

export function getConversation(id: string) {
  return apiClient<ServerConversationDetail>(`/agent/conversations/${id}`);
}

export function createConversation(title: string) {
  return apiClient<ServerConversation>('/agent/conversations', {
    method: 'POST',
    body: { title },
  });
}

export function updateConversation(
  id: string,
  data: { title?: string; archived?: boolean }
) {
  return apiClient<ServerConversation>(`/agent/conversations/${id}`, {
    method: 'PATCH',
    body: data,
  });
}

export function deleteConversation(id: string) {
  return apiClient<void>(`/agent/conversations/${id}`, {
    method: 'DELETE',
  });
}

export function saveMessages(id: string, messages: SavedMessage[]) {
  return apiClient<void>(`/agent/conversations/${id}/messages`, {
    method: 'POST',
    body: { messages },
  });
}
