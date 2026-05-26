-- Enable pgcrypto for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- Step 1: Drop foreign keys to allow data changes
-- ============================================

ALTER TABLE "Bill" DROP CONSTRAINT IF EXISTS "Bill_monthlyBillId_fkey";
ALTER TABLE "DepositPayment" DROP CONSTRAINT IF EXISTS "DepositPayment_depositId_fkey";
ALTER TABLE "DepositPayment" DROP CONSTRAINT IF EXISTS "DepositPayment_userId_fkey";
ALTER TABLE "MonthlyBill" DROP CONSTRAINT IF EXISTS "MonthlyBill_leaseId_fkey";
ALTER TABLE "MonthlyBill" DROP CONSTRAINT IF EXISTS "MonthlyBill_organizationId_fkey";
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_billId_fkey";
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_monthlyBillId_fkey";

-- ============================================
-- Step 2: Add new columns early so data migration can use them
-- ============================================

DO $$ BEGIN
  ALTER TABLE "Payment" ADD COLUMN "type" "PaymentType" NOT NULL DEFAULT 'RECEIVE';
EXCEPTION WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Deposit" ADD COLUMN "billId" TEXT;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

-- ============================================
-- Step 3: Data migration
-- ============================================

-- Migrate MonthlyBill Payments to Bill Payments
UPDATE "Payment" p
SET "billId" = (
  SELECT b.id FROM "Bill" b
  WHERE b."monthlyBillId" = p."monthlyBillId"
  LIMIT 1
)
WHERE p."monthlyBillId" IS NOT NULL;

-- Create DEPOSIT bills for deposits that don't have one yet
INSERT INTO "Bill" ("id", "organizationId", "leaseId", "mode", "billingDate", "periodStart", "periodEnd", "dueDate", "status", "totalAmount", "paidAmount", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  d."organizationId",
  d."leaseId",
  'DEPOSIT',
  d."createdAt",
  d."createdAt",
  d."createdAt",
  d."createdAt",
  CASE WHEN d."paidAmount" > 0 THEN 'PAID'::"BillStatus" ELSE 'UNPAID'::"BillStatus" END,
  d."amount",
  d."paidAmount",
  d."createdAt",
  d."createdAt"
FROM "Deposit" d
WHERE NOT EXISTS (
  SELECT 1 FROM "Bill" b WHERE b."leaseId" = d."leaseId" AND b."mode" = 'DEPOSIT'
);

-- Create BillItem for each new DEPOSIT bill
INSERT INTO "BillItem" ("id", "billId", "type", "name", "amount", "status")
SELECT
  gen_random_uuid()::text,
  b.id,
  'DEPOSIT',
  '押金',
  b."totalAmount",
  b.status::"BillStatus"
FROM "Bill" b
WHERE b."mode" = 'DEPOSIT'
AND NOT EXISTS (
  SELECT 1 FROM "BillItem" bi WHERE bi."billId" = b.id
);

-- Migrate DepositPayments to Payments
INSERT INTO "Payment" ("id", "billId", "userId", "type", "amount", "paidAt", "method", "note", "status")
SELECT
  dp.id,
  b.id,
  dp."userId",
  CASE dp.type
    WHEN 'COLLECT' THEN 'RECEIVE'::"PaymentType"
    WHEN 'REFUND' THEN 'REFUND'::"PaymentType"
    WHEN 'DEDUCT' THEN 'DEDUCT'::"PaymentType"
  END,
  dp.amount,
  dp."paidAt",
  dp.method,
  dp.note,
  'COMPLETED'::"PaymentStatus"
FROM "DepositPayment" dp
JOIN "Deposit" d ON dp."depositId" = d.id
JOIN "Bill" b ON b."leaseId" = d."leaseId" AND b."mode" = 'DEPOSIT';

-- Update Deposit billId
UPDATE "Deposit" d
SET "billId" = (
  SELECT b.id FROM "Bill" b
  WHERE b."leaseId" = d."leaseId" AND b."mode" = 'DEPOSIT'
  LIMIT 1
);

-- ============================================
-- Step 4: Schema changes
-- ============================================

ALTER TABLE "Bill" DROP COLUMN "monthlyBillId";

ALTER TABLE "Payment" DROP COLUMN "monthlyBillId",
DROP COLUMN "refundedAmount",
ALTER COLUMN "billId" SET NOT NULL;

DROP TABLE "DepositPayment";
DROP TABLE "MonthlyBill";
DROP TYPE "DepositPaymentType";

CREATE UNIQUE INDEX "Deposit_billId_key" ON "Deposit"("billId");
CREATE INDEX "Payment_billId_paidAt_idx" ON "Payment"("billId", "paidAt");

ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
