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

export async function ensureSystemSettings(
  deps: {
    prisma?: typeof prisma;
  } = {}
): Promise<void> {
  const db = deps.prisma ?? prisma;

  const defaults: Array<{ key: string; value: object; description: string }> = [
    {
      key: "quota_limit_enabled",
      value: { enabled: false },
      description: "是否开启用量限制：开启后用户需订阅套餐才能使用，关闭后所有用户不限量"
    },
    {
      key: "platform_info",
      value: { name: "Tenant Hub", logoUrl: "", contactPhone: "" },
      description: "平台基础信息：名称、Logo、客服电话"
    }
  ];

  for (const item of defaults) {
    const existing = await db.systemSetting.findUnique({ where: { key: item.key } });
    if (!existing) {
      await db.systemSetting.create({ data: item });
      console.info(`[TenantHub] 系统设置项 ${item.key} 已自动创建`);
    }
  }
}
