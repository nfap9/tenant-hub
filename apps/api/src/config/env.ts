import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(12).default("tenant-hub-dev-secret"),
  CORS_ORIGINS: z.string().default("http://localhost:5173,http://localhost:8081,http://localhost:19006"),
  PLATFORM_ADMIN_PHONES: z.string().default(""),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development")
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

export const platformAdminPhones = env.PLATFORM_ADMIN_PHONES.split(",")
  .map((phone) => phone.trim())
  .filter(Boolean);
