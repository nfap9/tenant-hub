-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('UNPAID', 'PAID', 'PARTIAL_REFUNDED', 'FULLY_REFUNDED', 'DEDUCTED');

-- CreateEnum
CREATE TYPE "DepositPaymentType" AS ENUM ('COLLECT', 'REFUND', 'DEDUCT');

-- CreateTable
CREATE TABLE "Deposit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deductedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "DepositStatus" NOT NULL DEFAULT 'UNPAID',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Deposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositPayment" (
    "id" TEXT NOT NULL,
    "depositId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "DepositPaymentType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL,
    "note" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DepositPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_leaseId_key" ON "Deposit"("leaseId");

-- CreateIndex
CREATE INDEX "Deposit_organizationId_status_idx" ON "Deposit"("organizationId", "status");

-- CreateIndex
CREATE INDEX "DepositPayment_depositId_paidAt_idx" ON "DepositPayment"("depositId", "paidAt");

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositPayment" ADD CONSTRAINT "DepositPayment_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "Deposit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositPayment" ADD CONSTRAINT "DepositPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed data: create Deposit records for existing leases with depositAmount > 0
INSERT INTO "Deposit" ("id", "organizationId", "leaseId", "amount", "paidAmount", "refundedAmount", "deductedAmount", "status", "createdAt", "updatedAt")
SELECT 
  gen_random_uuid(),
  l."organizationId",
  l."id",
  l."depositAmount",
  0,
  0,
  0,
  'UNPAID',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Lease" l
WHERE l."depositAmount" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "Deposit" d WHERE d."leaseId" = l."id"
  );
