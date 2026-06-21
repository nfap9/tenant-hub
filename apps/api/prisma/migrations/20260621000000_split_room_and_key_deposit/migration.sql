-- CreateEnum
CREATE TYPE "DepositType" AS ENUM ('ROOM', 'KEY');

-- DropIndex
DROP INDEX "Deposit_leaseId_key";

-- AlterTable
ALTER TABLE "Deposit" ADD COLUMN     "type" "DepositType" NOT NULL DEFAULT 'ROOM';

-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "keyQuantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "keyUnitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "roomDepositAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Migrate historical deposit amount to room deposit amount
UPDATE "Lease" SET "roomDepositAmount" = "depositAmount" WHERE "roomDepositAmount" = 0;

-- AlterTable
ALTER TABLE "LeaseSettlement" ADD COLUMN     "keyDepositAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "keyDepositDeductionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "keyDepositRefundAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "roomDepositAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "roomDepositDeductionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "roomDepositRefundAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Migrate historical total deposit deduction to room deposit deduction
UPDATE "LeaseSettlement" SET "roomDepositDeductionAmount" = "depositDeductionAmount";

-- Drop historical total deposit deduction column
ALTER TABLE "LeaseSettlement" DROP COLUMN "depositDeductionAmount";

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_leaseId_type_key" ON "Deposit"("leaseId", "type");
