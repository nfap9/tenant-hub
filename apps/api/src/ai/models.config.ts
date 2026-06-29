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
}

const isSet = (v: string | undefined): boolean => !!v && v.length > 0;

const BASE_MODELS: ModelConfig[] = [
  {
    id: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    providerModel: 'claude-sonnet-4-6',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    maxTokens: 8192,
    temperature: 0.3,
    enabled: isSet(env.ANTHROPIC_API_KEY),
    tags: ['chat', 'strong'],
    costPerMtu: { input: 3, output: 15 },
    fallbackTo: ['claude-haiku-4-5', 'deepseek-chat'],
  },
  {
    id: 'claude-haiku-4-5',
    displayName: 'Claude Haiku 4.5',
    provider: 'anthropic',
    providerModel: 'claude-haiku-4-5-20251001',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    maxTokens: 4096,
    temperature: 0.2,
    enabled: isSet(env.ANTHROPIC_API_KEY),
    tags: ['chat', 'cheap'],
    costPerMtu: { input: 0.8, output: 4 },
  },
  {
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    provider: 'openai',
    providerModel: 'gpt-4o',
    apiKeyEnv: 'OPENAI_API_KEY',
    maxTokens: 4096,
    temperature: 0.3,
    enabled: isSet(env.OPENAI_API_KEY),
    tags: ['chat', 'strong'],
    costPerMtu: { input: 2.5, output: 10 },
  },
  {
    id: 'deepseek-chat',
    displayName: 'DeepSeek Chat',
    provider: 'openai-compat',
    providerModel: 'deepseek-chat',
    baseURL: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    maxTokens: 4096,
    temperature: 0.3,
    enabled: isSet(env.DEEPSEEK_API_KEY),
    tags: ['chat', 'cheap'],
    costPerMtu: { input: 0.14, output: 0.28 },
  },
  {
    id: 'qwen-plus',
    displayName: '通义千问 Plus',
    provider: 'openai-compat',
    providerModel: 'qwen-plus',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyEnv: 'QWEN_API_KEY',
    maxTokens: 4096,
    temperature: 0.3,
    enabled: isSet(env.QWEN_API_KEY),
    tags: ['chat', 'cheap'],
  },
  {
    id: 'moonshot-v1-8k',
    displayName: 'Moonshot v1 8k',
    provider: 'openai-compat',
    providerModel: 'moonshot-v1-8k',
    baseURL: 'https://api.moonshot.cn/v1',
    apiKeyEnv: 'MOONSHOT_API_KEY',
    maxTokens: 4096,
    temperature: 0.3,
    enabled: isSet(env.MOONSHOT_API_KEY),
    tags: ['chat', 'cheap'],
  },
  {
    id: 'local-ollama',
    displayName: '本地 Ollama (qwen2.5)',
    provider: 'openai-compat',
    providerModel: 'qwen2.5:14b',
    baseURL: 'http://localhost:11434/v1',
    apiKeyEnv: 'OLLAMA_API_KEY',
    apiKeyFallback: 'ollama',
    maxTokens: 4096,
    temperature: 0.3,
    enabled: env.AI_ALLOW_LOCAL,
    tags: ['chat', 'local'],
  },
];

const parseCustomModels = (): ModelConfig[] => {
  if (!env.AI_CUSTOM_MODELS) return [];
  try {
    const parsed = JSON.parse(env.AI_CUSTOM_MODELS) as ModelConfig[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
};

export const MODEL_REGISTRY: ModelConfig[] = [
  ...BASE_MODELS,
  ...parseCustomModels(),
];

export const findModel = (id: string): ModelConfig | undefined =>
  MODEL_REGISTRY.find((m) => m.id === id);

export const listEnabledModels = (): ModelConfig[] =>
  MODEL_REGISTRY.filter((m) => m.enabled);

export const resolveDefaultModel = (): ModelConfig => {
  const explicit = findModel(env.AI_DEFAULT_MODEL_ID);
  if (explicit && explicit.enabled) return explicit;
  const enabled = listEnabledModels();
  if (enabled.length === 0) {
    throw new Error(
      'AI 未配置任何可用模型，请在环境变量中设置至少一个 Provider 密钥'
    );
  }
  return enabled[0];
};
