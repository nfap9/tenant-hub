import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(12).default("tenant-hub-dev-secret"),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.string().default("development")
});

export const env = envSchema.parse(process.env);
