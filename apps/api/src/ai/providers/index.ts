import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http.js';
import type { ModelProvider } from '../types.js';
import type { ModelConfig } from '../models.config.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAICompatProvider, OpenAIProvider } from './openai.js';

const cache = new Map<string, ModelProvider>();

const isSet = (v: string | undefined): boolean => !!v && v.length > 0;

const resolveApiKey = (cfg: ModelConfig): string => {
  const value = env.AI_API_KEY ?? cfg.apiKeyFallback;
  if (!value) {
    throw new HttpError(500, `模型 ${cfg.id} 缺少 API 密钥：AI_API_KEY`);
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

export const isAiEnabled = () => isSet(env.AI_API_KEY);
