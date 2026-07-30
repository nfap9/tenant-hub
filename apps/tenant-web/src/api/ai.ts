import { apiClient, readOrgId, readSession } from './client';

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

export type AiMessageRole = 'SYSTEM' | 'USER' | 'ASSISTANT' | 'TOOL';

export type AiMessageRecord = {
  id: string;
  role: AiMessageRole;
  content: unknown;
  modelId?: string | null;
  tokensInput?: number | null;
  tokensOutput?: number | null;
  createdAt: string;
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

export type PendingActionEvent = {
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

/** 历史回放用的待确认操作记录（含已处理终态） */
export type AiPendingActionRecord = PendingActionEvent & {
  input?: unknown;
  status: AiPendingActionStatus;
  createdAt: string;
};

export type AgentEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'assistant_message'; text: string }
  | { type: 'tool_call'; name: string; summary: string }
  | { type: 'pending_action'; action: PendingActionEvent }
  | { type: 'error'; message: string }
  | { type: 'done' };

export type ConfirmActionResult = {
  actionId: string;
  toolName: string;
  ok: boolean;
  summary: string;
  data?: unknown;
};

export async function listAiModels(): Promise<AiModelOption[]> {
  return apiClient<AiModelOption[]>('/ai/models');
}

export async function listAiConversations(): Promise<AiConversationSummary[]> {
  return apiClient<AiConversationSummary[]>('/ai/conversations');
}

export async function createAiConversation(
  modelId?: string
): Promise<AiConversationSummary> {
  return apiClient<AiConversationSummary>('/ai/conversations', {
    method: 'POST',
    body: modelId ? { modelId } : {},
  });
}

export async function listAiMessages(
  conversationId: string
): Promise<AiMessageRecord[]> {
  return apiClient<AiMessageRecord[]>(
    `/ai/conversations/${conversationId}/messages`
  );
}

export async function listAiPendingActions(
  conversationId: string
): Promise<AiPendingActionRecord[]> {
  return apiClient<AiPendingActionRecord[]>(
    `/ai/conversations/${conversationId}/pending-actions`
  );
}

export async function archiveAiConversation(
  conversationId: string
): Promise<void> {
  await apiClient<{ archived: boolean }>(
    `/ai/conversations/${conversationId}`,
    { method: 'DELETE' }
  );
}

export async function confirmAiAction(
  actionId: string
): Promise<ConfirmActionResult> {
  return apiClient<ConfirmActionResult>('/ai/action/confirm', {
    method: 'POST',
    body: { actionId },
  });
}

export async function rejectAiAction(actionId: string): Promise<void> {
  await apiClient<{ rejected: boolean }>('/ai/action/reject', {
    method: 'POST',
    body: { actionId },
  });
}

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

/**
 * 通过 SSE 流式发送消息。返回一个可中止的控制器与事件回调注册函数。
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
  const session = readSession();
  const orgId = readOrgId();

  (async () => {
    try {
      const response = await fetch(
        `${API_BASE}/ai/conversations/${params.conversationId}/chat`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'text/event-stream',
            ...(session.token
              ? { authorization: `Bearer ${session.token}` }
              : {}),
            ...(orgId ? { 'x-organization-id': orgId } : {}),
          },
          body: JSON.stringify({
            message: params.message,
            modelId: params.modelId,
          }),
          signal: controller.signal,
        }
      );

      if (!response.ok || !response.body) {
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
      params.onError(err instanceof Error ? err : new Error('SSE 失败'));
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
