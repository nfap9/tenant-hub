import { apiClient } from '@/api/client';
import type {
  AiModel,
  AiMessageRecord,
  ConfirmActionResult,
  Conversation,
  PendingAction,
} from './types';

export const listModels = () => apiClient<AiModel[]>('/ai/models');

export const listConversations = () =>
  apiClient<Conversation[]>('/ai/conversations');

export const createConversation = (modelId?: string) =>
  apiClient<Conversation>('/ai/conversations', {
    method: 'POST',
    body: modelId ? { modelId } : {},
  });

export const archiveConversation = (conversationId: string) =>
  apiClient<{ archived: boolean }>(`/ai/conversations/${conversationId}`, {
    method: 'DELETE',
  });

export const listMessages = (conversationId: string) =>
  apiClient<AiMessageRecord[]>(`/ai/conversations/${conversationId}/messages`);

export const listPendingActions = (conversationId: string) =>
  apiClient<PendingAction[]>(
    `/ai/conversations/${conversationId}/pending-actions`
  );

export const confirmAction = (actionId: string) =>
  apiClient<ConfirmActionResult>('/ai/action/confirm', {
    method: 'POST',
    body: { actionId },
  });

export const rejectAction = (actionId: string) =>
  apiClient<{ rejected: boolean }>('/ai/action/reject', {
    method: 'POST',
    body: { actionId },
  });
