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
  /** 单次请求的最大输出 token 数（传给 provider 的 max_tokens） */
  maxTokens: number;
  /** 模型上下文窗口大小（token），仅作元数据，供后续历史截断使用 */
  contextWindowTokens: number;
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
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    maxTokens: 8192,
    contextWindowTokens: 200_000,
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
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    maxTokens: 4096,
    contextWindowTokens: 200_000,
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
    apiKeyEnv: 'OPENAI_API_KEY',
    maxTokens: 4096,
    contextWindowTokens: 128_000,
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
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    maxTokens: 4096,
    contextWindowTokens: 64_000,
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
    apiKeyEnv: 'DASHSCOPE_API_KEY',
    maxTokens: 4096,
    contextWindowTokens: 128_000,
    temperature: 0.3,
    tags: ['chat', 'cheap'],
  },
  'moonshot-v1-8k': {
    id: 'moonshot-v1-8k',
    displayName: 'Moonshot v1 8k',
    provider: 'openai-compat',
    providerModel: 'moonshot-v1-8k',
    baseURL: 'https://api.moonshot.cn/v1',
    apiKeyEnv: 'MOONSHOT_API_KEY',
    maxTokens: 4096,
    contextWindowTokens: 8_000,
    temperature: 0.3,
    tags: ['chat', 'cheap'],
  },
  'local-ollama': {
    id: 'local-ollama',
    displayName: '本地 Ollama (qwen2.5)',
    provider: 'openai-compat',
    providerModel: 'qwen2.5:14b',
    baseURL: 'http://localhost:11434/v1',
    apiKeyEnv: 'OLLAMA_API_KEY',
    apiKeyFallback: 'ollama',
    maxTokens: 4096,
    contextWindowTokens: 32_000,
    temperature: 0.3,
    tags: ['chat', 'local'],
  },
};

/**
 * 用户显式设置 AI_MAX_CONTEXT_TOKENS 时覆盖激活模型的上下文窗口元数据。
 * 注意它与 maxTokens（最大输出 token）是两个概念，互不影响。
 */
const contextWindowOverride = (): number | undefined =>
  isSet(process.env.AI_MAX_CONTEXT_TOKENS)
    ? env.AI_MAX_CONTEXT_TOKENS
    : undefined;

/**
 * 构建内置模型的运行时配置。
 * enabled 判定：
 * - 本地模型（tags 含 local）：仅当 AI_ALLOW_LOCAL=true
 * - env 激活模型（AI_MODEL_NAME 指向它且 AI_API_KEY 已设置）：启用，并应用
 *   AI_API_FORMAT / AI_API_URL / AI_AUTH_HEADER 覆盖
 * - 其他模型：对应的 apiKeyEnv 存在即启用
 */
const buildKnownModel = (def: ModelDefaults): ModelConfig => {
  const isLocal = def.tags.includes('local');
  const isActive = def.id === env.AI_MODEL_NAME && isSet(env.AI_API_KEY);
  const enabled = isLocal
    ? env.AI_ALLOW_LOCAL
    : isActive || isSet(process.env[def.apiKeyEnv]);

  const provider =
    isActive && env.AI_API_FORMAT
      ? parseApiFormat(env.AI_API_FORMAT)
      : def.provider;

  return {
    ...def,
    provider,
    baseURL: isActive ? (env.AI_API_URL ?? def.baseURL) : def.baseURL,
    contextWindowTokens:
      (isActive ? contextWindowOverride() : undefined) ??
      def.contextWindowTokens,
    authHeader:
      (isActive ? env.AI_AUTH_HEADER : undefined) ??
      defaultAuthHeader(provider),
    enabled,
  };
};

/** AI_MODEL_NAME 不是内置模型时，按自定义模型注册（兼容旧单模型配置方式） */
const buildCustomModel = (): ModelConfig | undefined => {
  if (KNOWN_MODELS[env.AI_MODEL_NAME] || !isSet(env.AI_API_KEY)) {
    return undefined;
  }
  const provider = env.AI_API_FORMAT
    ? parseApiFormat(env.AI_API_FORMAT)
    : 'anthropic';
  return {
    id: env.AI_MODEL_NAME,
    displayName: env.AI_MODEL_NAME,
    provider,
    providerModel: env.AI_MODEL_NAME,
    baseURL: env.AI_API_URL,
    apiKeyEnv: 'AI_API_KEY',
    apiKeyFallback: 'ollama',
    maxTokens: 4096,
    contextWindowTokens: env.AI_MAX_CONTEXT_TOKENS,
    temperature: 0.3,
    enabled: true,
    tags: ['chat'],
    authHeader: env.AI_AUTH_HEADER ?? defaultAuthHeader(provider),
  };
};

const customModel = buildCustomModel();

/** 全量模型注册表：包含所有内置模型，是否可用由 enabled 标记决定 */
export const MODEL_REGISTRY: ModelConfig[] = [
  ...Object.values(KNOWN_MODELS).map(buildKnownModel),
  ...(customModel ? [customModel] : []),
];

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
    throw new Error(
      'AI 未配置：请在环境变量中设置 AI_API_KEY 并指定 AI_MODEL_NAME'
    );
  }
  return enabled[0];
};
