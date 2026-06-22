-- 为 Bill 增加押金类型字段，用于区分房间押金账单与钥匙押金账单
ALTER TABLE "Bill" ADD COLUMN "depositType" TEXT NOT NULL DEFAULT 'NONE';

-- 将已有押金账单的 depositType 同步为 Deposit.type
UPDATE "Bill" AS b
SET "depositType" = d.type
FROM "Deposit" AS d
WHERE b.id = d."billId" AND b.mode = 'DEPOSIT';

-- 移除旧唯一索引，新增包含 depositType 的唯一索引
DROP INDEX "Bill_leaseId_billingDate_mode_key";
CREATE UNIQUE INDEX "Bill_leaseId_billingDate_mode_depositType_key"
  ON "Bill"("leaseId", "billingDate", "mode", "depositType");
