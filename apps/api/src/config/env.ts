import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Ensure .env is loaded from repo root even when cwd is a workspace (e.g. pnpm -r test)
config({ path: resolve(__dirname, "../../../../.env") });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(12).default("tenant-hub-dev-secret"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGINS: z.string().default("http://localhost:5173,http://localhost:8081,http://localhost:19006"),
  PORT: z.coerce.number().default(4000),
  OTP_EXPIRES_IN_MINUTES: z.coerce.number().default(5),
  BCRYPT_OTP_SALT_ROUNDS: z.coerce.number().default(10),
  BCRYPT_PASSWORD_SALT_ROUNDS: z.coerce.number().default(12),
  INVITE_EXPIRES_IN_HOURS: z.coerce.number().default(24),
  INVITE_EXPIRES_MAX_HOURS: z.coerce.number().default(168),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  PLATFORM_ADMIN_PHONE: z.string().default(""),
  PLATFORM_ADMIN_PASSWORD: z.string().default(""),
  SCHEDULER_ENABLED: z.enum(["true", "false"]).default("true")
}).superRefine((value, ctx) => {
  if (value.NODE_ENV !== "production") return;
  if (value.JWT_SECRET === "tenant-hub-dev-secret") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["JWT_SECRET"],
      message: "JWT_SECRET must be explicitly configured in production"
    });
  }
});

export const parseEnv = (source: NodeJS.ProcessEnv) => envSchema.parse(source);

export const env = parseEnv(process.env);

export const corsOrigins = env.CORS_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const platformAdminPhones = env.PLATFORM_ADMIN_PHONE ? [env.PLATFORM_ADMIN_PHONE] : [];
