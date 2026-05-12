import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

export async function ensurePlatformAdmin(
  deps: {
    env?: Pick<typeof env, "PLATFORM_ADMIN_PHONE" | "PLATFORM_ADMIN_PASSWORD" | "BCRYPT_PASSWORD_SALT_ROUNDS">;
    prisma?: typeof prisma;
  } = {}
): Promise<void> {
  const envCfg = deps.env ?? env;
  const db = deps.prisma ?? prisma;
  const phone = envCfg.PLATFORM_ADMIN_PHONE;
  const password = envCfg.PLATFORM_ADMIN_PASSWORD;
  if (!phone || !password) return;

  const existing = await db.user.findUnique({ where: { phone } });
  if (existing) {
    console.info(`[TenantHub] 平台管理员账号 ${phone} 已存在，跳过自动创建`);
    return;
  }

  await db.user.create({
    data: {
      phone,
      username: "超级管理员",
      passwordHash: await bcrypt.hash(password, envCfg.BCRYPT_PASSWORD_SALT_ROUNDS),
      platformRole: "SUPER_ADMIN"
    }
  });

  console.info(`[TenantHub] 平台管理员账号 ${phone} 已自动创建`);
}
