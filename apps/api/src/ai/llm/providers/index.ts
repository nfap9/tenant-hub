import { env } from '../../../config/env.js';
import { HttpError } from '../../../utils/http.js';
import type { ModelProvider } from '../types.js';
import type { ModelConfig } from '../../models/types.js';
import { listEnabledModels } from '../../models/registry.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAICompatProvider, OpenAIProvider } from './openai.js';

const cache = new Map<string, ModelProvider>();

const resolveApiKey = (cfg: ModelConfig): string => {
  // 优先模型自身配置的 apiKey，其次通用 AI_API_KEY
  const value = cfg.apiKey ?? env.AI_API_KEY;
  if (!value) {
    throw new HttpError(
      500,
      `模型 ${cfg.id} 缺少 API 密钥：请在 AI_MODELS 中为该模型配置 apiKey，或设置通用 AI_API_KEY`
    );
  }
  return value;
};

export const getProvider = (cfg: ModelConfig): ModelProvider => {
  const cached = cache.get(cfg.id);
  if (cached) return cached;

  const apiKey = resolveApiKey(cfg);
  const authHeader =
    cfg.authHeader ??
    (cfg.provider === 'anthropic' ? 'x-api-key' : 'Authorization');
  let provider: ModelProvider;
  switch (cfg.provider) {
    case 'anthropic':
      provider = new AnthropicProvider(apiKey, cfg.baseURL, authHeader);
      break;
    case 'openai':
      provider = new OpenAIProvider(apiKey, cfg.baseURL, authHeader);
      break;
    case 'openai-compat':
      provider = new OpenAICompatProvider(apiKey, cfg.baseURL, authHeader);
      break;
    default:
      throw new HttpError(500, `未知 Provider：${cfg.provider}`);
  }
  cache.set(cfg.id, provider);
  return provider;
};

export const clearProviderCache = () => cache.clear();

export const isAiEnabled = () => listEnabledModels().length > 0;
