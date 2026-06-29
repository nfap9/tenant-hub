import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../../.env') });

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().default('tenant-hub-dev-secret'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:5174,http://localhost:8081'),
    PORT: z.coerce.number().default(4000),
    BCRYPT_PASSWORD_SALT_ROUNDS: z.coerce.number().default(12),
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),

    // AI Provider 密钥（按需启用）
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    DEEPSEEK_API_KEY: z.string().optional(),
    QWEN_API_KEY: z.string().optional(),
    MOONSHOT_API_KEY: z.string().optional(),
    OLLAMA_API_KEY: z.string().optional(),

    // AI 全局配置
    AI_ENABLED: z.coerce.boolean().default(true),
    AI_DEFAULT_MODEL_ID: z.string().default('claude-sonnet-4-6'),
    AI_ALLOW_LOCAL: z.coerce.boolean().default(false),
    AI_MAX_ITERATIONS: z.coerce.number().default(8),
    AI_RATE_LIMIT_PER_MIN: z.coerce.number().default(20),
    AI_PENDING_ACTION_TTL_MIN: z.coerce.number().default(10),
    AI_HISTORY_MAX_TURNS: z.coerce.number().default(20),
    AI_CUSTOM_MODELS: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'production') return;
    if (value.JWT_SECRET === 'tenant-hub-dev-secret') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be explicitly configured in production',
      });
    }
  });

export const parseEnv = (source: NodeJS.ProcessEnv) => envSchema.parse(source);

export const env = parseEnv(process.env);

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
