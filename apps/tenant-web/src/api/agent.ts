import { readSession } from './client';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface StreamChunk {
  type: 'status' | 'message' | 'done' | 'error';
  content: string;
}

export async function* chatWithAgent(
  message: string,
  history: ChatMessage[],
  organizationId: string
): AsyncGenerator<StreamChunk> {
  const API_BASE =
    import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
  const session = readSession();
  const token = session.token;

  const response = await fetch(`${API_BASE}/agent/chat`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'x-organization-id': organizationId,
    },
    body: JSON.stringify({ message, history }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      text ? JSON.parse(text).error || text : `请求失败 (${response.status})`
    );
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
