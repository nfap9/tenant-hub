import { apiClient } from '../client';
import type {
  AiConversationSummary,
  AiMessageRecord,
  AiModelOption,
  AiPendingActionRecord,
  ConfirmActionResult,
} from './types';

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
