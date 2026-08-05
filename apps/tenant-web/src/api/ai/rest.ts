import { apiClient } from '../client';
import type {
  AiConversationState,
  AiConversationSummary,
  AiModelOption,
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

export async function getAiConversationState(
  conversationId: string
): Promise<AiConversationState> {
  return apiClient<AiConversationState>(
    `/ai/conversations/${conversationId}/state`
  );
}

export async function archiveAiConversation(
  conversationId: string
): Promise<void> {
  await apiClient<{ archived: boolean }>(
    `/ai/conversations/${conversationId}/archive`,
    { method: 'POST' }
  );
}
