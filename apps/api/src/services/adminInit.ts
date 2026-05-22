import { prisma } from "../config/prisma.js";

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
