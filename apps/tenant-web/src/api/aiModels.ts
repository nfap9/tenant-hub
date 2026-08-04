import { apiClient } from './client';

export type AiModelProvider = 'anthropic' | 'openai' | 'openai-compat';

export type AiModelCost = {
  input: number;
  output: number;
};

/** 模型管理接口返回的完整模型记录（apiKey 永不回传，仅有 hasApiKey 标记） */
export type ManagedAiModel = {
  id: string;
  displayName: string;
  provider: AiModelProvider;
  providerModel: string;
  baseURL?: string | null;
  maxTokens: number;
  contextWindowTokens: number;
  temperature: number;
  tags: string[];
  costPerMtu?: AiModelCost | null;
  fallbackTo: string[];
  authHeader?: string | null;
  enabled: boolean;
  hasApiKey: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateAiModelInput = {
  id: string;
  displayName: string;
  provider: AiModelProvider;
  providerModel: string;
  baseURL?: string;
  apiKey?: string;
  maxTokens?: number;
  contextWindowTokens?: number;
  temperature?: number;
  tags?: string[];
  costPerMtu?: AiModelCost;
  fallbackTo?: string[];
  authHeader?: string;
  enabled?: boolean;
};

export type UpdateAiModelInput = Partial<Omit<CreateAiModelInput, 'id'>>;

export async function listManagedAiModels(): Promise<ManagedAiModel[]> {
  return apiClient<ManagedAiModel[]>('/ai-models');
}

export async function createAiModel(
  input: CreateAiModelInput
): Promise<ManagedAiModel> {
  return apiClient<ManagedAiModel>('/ai-models', {
    method: 'POST',
    body: input as Record<string, unknown>,
  });
}

export async function updateAiModel(
  id: string,
  input: UpdateAiModelInput
): Promise<ManagedAiModel> {
  return apiClient<ManagedAiModel>(`/ai-models/${id}`, {
    method: 'PATCH',
    body: input as Record<string, unknown>,
  });
}

export async function deleteAiModel(id: string): Promise<void> {
  await apiClient<{ deleted: boolean }>(`/ai-models/${id}`, {
    method: 'DELETE',
  });
}
