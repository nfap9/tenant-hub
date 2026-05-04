import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(12).default("tenant-hub-dev-secret"),
  PLATFORM_ADMIN_PHONES: z.string().default(""),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.string().default("development")
});

export const env = envSchema.parse(process.env);

export const platformAdminPhones = env.PLATFORM_ADMIN_PHONES.split(",")
  .map((phone) => phone.trim())
  .filter(Boolean);
