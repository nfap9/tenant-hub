-- 精简账单状态：移除 DRAFT（未使用）、PARTIAL_PAID（无业务场景）、FAILED（使用率极低）
-- 先迁移已有数据到保留的状态
UPDATE "Bill" SET "status" = 'UNPAID' WHERE "status" IN ('DRAFT', 'PARTIAL_PAID');
UPDATE "Bill" SET "status" = 'BILLING' WHERE "status" = 'FAILED';
UPDATE "BillItem" SET "status" = 'UNPAID' WHERE "status" IN ('DRAFT', 'PARTIAL_PAID');
UPDATE "BillItem" SET "status" = 'BILLING' WHERE "status" = 'FAILED';

-- 替换枚举类型
ALTER TYPE "BillStatus" RENAME TO "BillStatus_old";
CREATE TYPE "BillStatus" AS ENUM ('BILLING', 'UNPAID', 'PAID', 'REFUNDED', 'VOID');
ALTER TABLE "Bill" ALTER COLUMN "status" TYPE "BillStatus" USING "status"::text::"BillStatus";
ALTER TABLE "BillItem" ALTER COLUMN "status" TYPE "BillStatus" USING "status"::text::"BillStatus";
DROP TYPE "BillStatus_old";
