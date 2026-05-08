import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

export async function ensurePlatformAdmin(): Promise<void> {
  const phone = env.PLATFORM_ADMIN_PHONE;
  const password = env.PLATFORM_ADMIN_PASSWORD;
  if (!phone || !password) return;

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    console.info(`[TenantHub] 平台管理员账号 ${phone} 已存在，跳过自动创建`);
    return;
  }

  await prisma.user.create({
    data: {
      phone,
      username: "超级管理员",
      passwordHash: await bcrypt.hash(password, env.BCRYPT_PASSWORD_SALT_ROUNDS),
      platformRole: "SUPER_ADMIN"
    }
  });

  console.info(`[TenantHub] 平台管理员账号 ${phone} 已自动创建`);
}
