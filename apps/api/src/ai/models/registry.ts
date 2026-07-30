import { z } from 'zod';
import { env } from '../../config/env.js';
import {
  modelConfigSchema,
  type ModelConfig,
  type ProviderKind,
} from './types.js';

const defaultAuthHeader = (provider: ProviderKind): string =>
  provider === 'anthropic' ? 'x-api-key' : 'Authorization';

/**
 * 解析 AI_MODELS 环境变量（JSON 数组）为模型注册表。
 * 配置不合法时直接抛错，让服务在启动阶段就暴露问题。
 */
const parseModels = (raw?: string): ModelConfig[] => {
  if (!raw || raw.trim().length === 0) return [];

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error('AI_MODELS 不是合法的 JSON');
  }

  const parsed = z.array(modelConfigSchema).safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`AI_MODELS 配置不合法：${issues}`);
  }

  return parsed.data.map((m) => ({
    ...m,
    authHeader: m.authHeader ?? defaultAuthHeader(m.provider),
  }));
};

/** 全量模型注册表：完全来自用户配置（AI_MODELS），无内置模型 */
export const MODEL_REGISTRY: ModelConfig[] = parseModels(env.AI_MODELS);

export const findModel = (id: string): ModelConfig | undefined =>
  MODEL_REGISTRY.find((m) => m.id === id);

/** 仅在模型存在且已启用时返回，fallback 链与组织默认模型都应使用它 */
export const findEnabledModel = (id: string): ModelConfig | undefined => {
  const model = findModel(id);
  return model?.enabled ? model : undefined;
};

export const listEnabledModels = (): ModelConfig[] =>
  MODEL_REGISTRY.filter((m) => m.enabled);

export const resolveDefaultModel = (): ModelConfig => {
  const enabled = listEnabledModels();
  if (enabled.length === 0) {
    throw new Error('AI 未配置：请在环境变量 AI_MODELS 中配置至少一个模型');
  }
  return enabled[0];
};
