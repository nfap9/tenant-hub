import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http.js';
import type { ModelProvider } from '../types.js';
import type { ModelConfig } from '../models.config.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAICompatProvider, OpenAIProvider } from './openai.js';

const cache = new Map<string, ModelProvider>();

const resolveApiKey = (cfg: ModelConfig): string => {
  const value = process.env[cfg.apiKeyEnv] ?? cfg.apiKeyFallback;
  if (!value) {
    throw new HttpError(500, `模型 ${cfg.id} 缺少 API 密钥：${cfg.apiKeyEnv}`);
  }
  return value;
};

export const getProvider = (cfg: ModelConfig): ModelProvider => {
  const cached = cache.get(cfg.id);
  if (cached) return cached;

  let provider: ModelProvider;
  switch (cfg.provider) {
    case 'anthropic':
      provider = new AnthropicProvider(resolveApiKey(cfg), cfg.baseURL);
      break;
    case 'openai':
      provider = new OpenAIProvider(resolveApiKey(cfg), cfg.baseURL);
      break;
    case 'openai-compat':
      provider = new OpenAICompatProvider(resolveApiKey(cfg), cfg.baseURL);
      break;
    default:
      throw new HttpError(500, `未知 Provider：${cfg.provider}`);
  }
  cache.set(cfg.id, provider);
  return provider;
};

export const clearProviderCache = () => cache.clear();

export const isAiEnabled = () => env.AI_ENABLED;
