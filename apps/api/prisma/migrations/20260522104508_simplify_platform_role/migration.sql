-- 创建新的 PlatformRole enum
CREATE TYPE "PlatformRole_new" AS ENUM ('USER', 'SUPER_ADMIN');

-- 修改列类型为新 enum，并将旧值映射到新值
ALTER TABLE "User" ALTER COLUMN "platformRole" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "platformRole" TYPE "PlatformRole_new" USING (
  CASE "platformRole"::text
    WHEN 'NONE' THEN 'USER'::"PlatformRole_new"
    WHEN 'OPERATOR' THEN 'USER'::"PlatformRole_new"
    WHEN 'ADMIN' THEN 'USER'::"PlatformRole_new"
    WHEN 'SUPER_ADMIN' THEN 'SUPER_ADMIN'::"PlatformRole_new"
  END
);
ALTER TABLE "User" ALTER COLUMN "platformRole" SET DEFAULT 'USER';

-- 删除旧 enum，重命名新 enum
DROP TYPE "PlatformRole";
ALTER TYPE "PlatformRole_new" RENAME TO "PlatformRole";
