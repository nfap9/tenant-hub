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

    // AI 配置：模型列表（JSON 数组，格式见 apps/api/src/ai/models/types.ts）
    AI_MODELS: z.string().optional(),
    // 通用 API 密钥，模型未单独配置 apiKey 时使用
    AI_API_KEY: z.string().optional(),
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
