import { env } from '../config/env.js';

export type ProviderKind = 'anthropic' | 'openai' | 'openai-compat';

export interface ModelConfig {
  id: string;
  displayName: string;
  provider: ProviderKind;
  providerModel: string;
  baseURL?: string;
  apiKeyEnv: string;
  apiKeyFallback?: string;
  maxTokens: number;
  temperature?: number;
  enabled: boolean;
  tags: string[];
  costPerMtu?: { input: number; output: number };
  fallbackTo?: string[];
  authHeader?: string;
}

const isSet = (v: string | undefined): boolean => !!v && v.length > 0;

const parseApiFormat = (format?: string): ProviderKind => {
  if (format === 'openai') return 'openai';
  if (format === 'openai-compatible') return 'openai-compat';
  return 'anthropic';
};

const defaultAuthHeader = (provider: ProviderKind): string => {
  if (provider === 'anthropic') return 'x-api-key';
  return 'Authorization';
};

type ModelDefaults = Omit<ModelConfig, 'enabled'>;

const KNOWN_MODELS: Record<string, ModelDefaults> = {
  'claude-sonnet-4-6': {
    id: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    providerModel: 'claude-sonnet-4-6',
    baseURL: 'https://api.anthropic.com',
    apiKeyEnv: 'AI_API_KEY',
    maxTokens: 8192,
    temperature: 0.3,
    tags: ['chat', 'strong'],
    costPerMtu: { input: 3, output: 15 },
    fallbackTo: ['claude-haiku-4-5', 'deepseek-chat'],
  },
  'claude-haiku-4-5': {
    id: 'claude-haiku-4-5',
    displayName: 'Claude Haiku 4.5',
    provider: 'anthropic',
    providerModel: 'claude-haiku-4-5-20251001',
    baseURL: 'https://api.anthropic.com',
    apiKeyEnv: 'AI_API_KEY',
    maxTokens: 4096,
    temperature: 0.2,
    tags: ['chat', 'cheap'],
    costPerMtu: { input: 0.8, output: 4 },
  },
  'gpt-4o': {
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    provider: 'openai',
    providerModel: 'gpt-4o',
    baseURL: 'https://api.openai.com/v1',
    apiKeyEnv: 'AI_API_KEY',
    maxTokens: 4096,
    temperature: 0.3,
    tags: ['chat', 'strong'],
    costPerMtu: { input: 2.5, output: 10 },
  },
  'deepseek-chat': {
    id: 'deepseek-chat',
    displayName: 'DeepSeek Chat',
    provider: 'openai-compat',
    providerModel: 'deepseek-chat',
    baseURL: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'AI_API_KEY',
    maxTokens: 4096,
    temperature: 0.3,
    tags: ['chat', 'cheap'],
    costPerMtu: { input: 0.14, output: 0.28 },
  },
  'qwen-plus': {
    id: 'qwen-plus',
    displayName: '通义千问 Plus',
    provider: 'openai-compat',
    providerModel: 'qwen-plus',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyEnv: 'AI_API_KEY',
    maxTokens: 4096,
    temperature: 0.3,
    tags: ['chat', 'cheap'],
  },
  'moonshot-v1-8k': {
    id: 'moonshot-v1-8k',
    displayName: 'Moonshot v1 8k',
    provider: 'openai-compat',
    providerModel: 'moonshot-v1-8k',
    baseURL: 'https://api.moonshot.cn/v1',
    apiKeyEnv: 'AI_API_KEY',
    maxTokens: 4096,
    temperature: 0.3,
    tags: ['chat', 'cheap'],
  },
  'local-ollama': {
    id: 'local-ollama',
    displayName: '本地 Ollama (qwen2.5)',
    provider: 'openai-compat',
    providerModel: 'qwen2.5:14b',
    baseURL: 'http://localhost:11434/v1',
    apiKeyEnv: 'AI_API_KEY',
    apiKeyFallback: 'ollama',
    maxTokens: 4096,
    temperature: 0.3,
    tags: ['chat', 'local'],
  },
};

const buildActiveModel = (): ModelConfig | undefined => {
  const apiKey = env.AI_API_KEY;
  if (!isSet(apiKey)) return undefined;

  const known = KNOWN_MODELS[env.AI_MODEL_NAME];
  const provider = env.AI_API_FORMAT
    ? parseApiFormat(env.AI_API_FORMAT)
    : (known?.provider ?? 'anthropic');
  const authHeader = env.AI_AUTH_HEADER ?? defaultAuthHeader(provider);

  if (known) {
    return {
      ...known,
      provider,
      baseURL: env.AI_API_URL ?? known.baseURL,
      authHeader,
      maxTokens: env.AI_MAX_CONTEXT_TOKENS,
      enabled: true,
    };
  }

  return {
    id: env.AI_MODEL_NAME,
    displayName: env.AI_MODEL_NAME,
    provider,
    providerModel: env.AI_MODEL_NAME,
    baseURL: env.AI_API_URL,
    apiKeyEnv: 'AI_API_KEY',
    apiKeyFallback: 'ollama',
    maxTokens: env.AI_MAX_CONTEXT_TOKENS,
    temperature: 0.3,
    enabled: true,
    tags: ['chat'],
    authHeader,
  };
};

const activeModel = buildActiveModel();

export const MODEL_REGISTRY: ModelConfig[] = activeModel ? [activeModel] : [];

export const findModel = (id: string): ModelConfig | undefined =>
  MODEL_REGISTRY.find((m) => m.id === id);

export const listEnabledModels = (): ModelConfig[] =>
  MODEL_REGISTRY.filter((m) => m.enabled);

export const resolveDefaultModel = (): ModelConfig => {
  const enabled = listEnabledModels();
  if (enabled.length === 0) {
    throw new Error(
      'AI 未配置：请在环境变量中设置 AI_API_KEY 并指定 AI_MODEL_NAME'
    );
  }
  return enabled[0];
};
