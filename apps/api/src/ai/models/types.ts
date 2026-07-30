import { z } from 'zod';

export type ProviderKind = 'anthropic' | 'openai' | 'openai-compat';

/**
 * 单个模型的配置格式（AI_MODELS 环境变量 JSON 数组的元素）。
 * 所有模型均由用户配置，系统不内置任何模型。
 */
export const modelConfigSchema = z.object({
  /** 内部 ID，会话与组织默认模型引用它 */
  id: z.string().min(1),
  /** 前端显示名 */
  displayName: z.string().min(1),
  /** API 协议类型 */
  provider: z.enum(['anthropic', 'openai', 'openai-compat']),
  /** 供应商侧的模型名 */
  providerModel: z.string().min(1),
  baseURL: z.string().optional(),
  /** 模型 API 密钥；缺省时回落到通用 AI_API_KEY */
  apiKey: z.string().optional(),
  /** 单次请求的最大输出 token 数（传给 provider 的 max_tokens） */
  maxTokens: z.number().int().positive().default(4096),
  /** 模型上下文窗口大小（token），仅作元数据，供后续历史截断使用 */
  contextWindowTokens: z.number().int().positive().default(128_000),
  temperature: z.number().min(0).max(2).default(0.3),
  tags: z.array(z.string()).default(['chat']),
  /** 成本估算（美元/百万 token），用于用量记账 */
  costPerMtu: z.object({ input: z.number(), output: z.number() }).optional(),
  /** 调用失败时的降级模型 id 链 */
  fallbackTo: z.array(z.string()).optional(),
  /** 认证字段名；缺省时按 provider 推导（anthropic → x-api-key，其他 → Authorization） */
  authHeader: z.string().optional(),
  enabled: z.boolean().default(true),
});

export type ModelConfig = z.infer<typeof modelConfigSchema>;
