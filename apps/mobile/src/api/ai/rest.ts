import { apiClient } from '@/api/client';
import type { AiModel, Conversation, ConversationState } from './types';

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

/** 会话完整状态：消息历史 + 当前待处理 interrupt + 待确认操作审计记录 */
export const getConversationState = (conversationId: string) =>
  apiClient<ConversationState>(`/ai/conversations/${conversationId}/state`);
