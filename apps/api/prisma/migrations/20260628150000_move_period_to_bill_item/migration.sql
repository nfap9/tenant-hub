-- 将账期从 Bill 表迁移到 BillItem 表
-- 业务语义：BillItem 记录费用发生的时间范围，Bill 仅作为结算凭证

-- 1. 在 BillItem 添加账期字段（先允许为空）
ALTER TABLE "BillItem" ADD COLUMN "periodStart" TIMESTAMP(3);
ALTER TABLE "BillItem" ADD COLUMN "periodEnd" TIMESTAMP(3);

-- 2. 将 Bill 的账期复制到同一账单下的所有 BillItem
UPDATE "BillItem"
SET "periodStart" = "Bill"."periodStart",
    "periodEnd" = "Bill"."periodEnd"
FROM "Bill"
WHERE "BillItem"."billId" = "Bill"."id";

-- 3. 设置为非空（与 schema 一致）
ALTER TABLE "BillItem" ALTER COLUMN "periodStart" SET NOT NULL;
ALTER TABLE "BillItem" ALTER COLUMN "periodEnd" SET NOT NULL;

-- 4. 从 Bill 移除账期字段
ALTER TABLE "Bill" DROP COLUMN "periodStart";
ALTER TABLE "Bill" DROP COLUMN "periodEnd";
