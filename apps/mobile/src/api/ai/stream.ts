import { fetch } from 'expo/fetch';
import { API_BASE } from '@/api/client';
import { useSessionStore } from '@/store/sessionStore';
import type { AgentEvent } from './types';

/**
 * 通过 SSE 流式发送消息。返回一个可中止的控制器。
 * Hermes 原生 fetch 不支持流式 body，必须用 expo/fetch（response.body 为 ReadableStream）。
 * 帧解析逻辑与 tenant-web 的 api/ai/stream.ts 保持一致。
 */
export function streamAiChat(params: {
  conversationId: string;
  message: string;
  modelId?: string;
  onEvent: (event: AgentEvent) => void;
  onError: (error: Error) => void;
  onClose?: () => void;
}): AbortController {
  const controller = new AbortController();
  const { token, currentOrgId } = useSessionStore.getState();

  (async () => {
    try {
      const response = await fetch(
        `${API_BASE}/ai/conversations/${params.conversationId}/chat`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'text/event-stream',
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            ...(currentOrgId ? { 'x-organization-id': currentOrgId } : {}),
          },
          body: JSON.stringify({
            message: params.message,
            modelId: params.modelId,
          }),
          signal: controller.signal,
        }
      );

      if (!response.ok || !response.body) {
        if (response.status === 401) {
          useSessionStore.getState().handleUnauthorized();
        }
        const text = await response.text().catch(() => '');
        let message = `请求失败 (${response.status})`;
        try {
          const parsed = text ? JSON.parse(text) : null;
          if (parsed?.error) message = parsed.error;
        } catch {
          // ignore
        }
        params.onError(new Error(message));
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
          if (event) params.onEvent(event);
        }
      }
      if (buffer.trim()) {
        const event = parseSseFrame(buffer);
        if (event) params.onEvent(event);
      }
      params.onClose?.();
    } catch (err) {
      if (controller.signal.aborted) {
        params.onClose?.();
        return;
      }
      params.onError(err instanceof Error ? err : new Error('网络请求失败'));
    }
  })();

  return controller;
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
  if (!type || !data) return null;
  try {
    return {
      type,
      ...(JSON.parse(data) as Record<string, unknown>),
    } as AgentEvent;
  } catch {
    return null;
  }
};
