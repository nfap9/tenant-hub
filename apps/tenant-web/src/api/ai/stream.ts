import { readOrgId, readSession } from '../client';
import type { AgentEvent } from './types';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

type StreamHandlers = {
  onEvent: (event: AgentEvent) => void;
  onError: (error: Error) => void;
  onClose?: () => void;
};

/** 建立 SSE 连接（POST + text/event-stream），返回可中止的控制器 */
function streamSse(
  path: string,
  body: Record<string, unknown>,
  handlers: StreamHandlers
): AbortController {
  const controller = new AbortController();
  const session = readSession();
  const orgId = readOrgId();

  (async () => {
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'text/event-stream',
          ...(session.token
            ? { authorization: `Bearer ${session.token}` }
            : {}),
          ...(orgId ? { 'x-organization-id': orgId } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => '');
        let message = `请求失败 (${response.status})`;
        try {
          const parsed = text ? JSON.parse(text) : null;
          if (parsed?.error) message = parsed.error;
        } catch {
          // ignore
        }
        handlers.onError(new Error(message));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          const event = parseSseFrame(frame);
          if (event) handlers.onEvent(event);
        }
      }
      if (buffer.trim()) {
        const event = parseSseFrame(buffer);
        if (event) handlers.onEvent(event);
      }
      handlers.onClose?.();
    } catch (err) {
      if (controller.signal.aborted) {
        handlers.onClose?.();
        return;
      }
      handlers.onError(err instanceof Error ? err : new Error('SSE 失败'));
    }
  })();

  return controller;
}

/** 通过 SSE 流式发送消息 */
export function streamAiChat(
  params: {
    conversationId: string;
    message: string;
    modelId?: string;
  } & StreamHandlers
): AbortController {
  return streamSse(
    `/ai/conversations/${params.conversationId}/chat`,
    { message: params.message, modelId: params.modelId },
    params
  );
}

/** 确认/拒绝 interrupt 待确认操作，通过 SSE 恢复图执行 */
export function streamAiResume(
  params: {
    conversationId: string;
    actionId: string;
    decision: 'approve' | 'reject';
  } & StreamHandlers
): AbortController {
  return streamSse(
    `/ai/conversations/${params.conversationId}/resume`,
    { actionId: params.actionId, decision: params.decision },
    params
  );
}

const parseSseFrame = (frame: string): AgentEvent | null => {
  let type = '';
  let data = '';
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) {
      type = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      data += line.slice(5).trim();
    }
  }
  if (!type) return null;
  // done 等事件无 data 负载
  if (!data) return { type } as AgentEvent;
  try {
    return {
      type,
      ...(JSON.parse(data) as Record<string, unknown>),
    } as AgentEvent;
  } catch {
    return null;
  }
};
