-- CreateEnum
CREATE TYPE "BillMode" AS ENUM ('PREPAID', 'POSTPAID');

-- CreateEnum
CREATE TYPE "MeterType" AS ENUM ('WATER', 'POWER');

-- CreateEnum
CREATE TYPE "MeterReadingSource" AS ENUM ('MANUAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "MeterReadingStatus" AS ENUM ('NORMAL', 'SUSPECTED', 'CONFIRMED', 'VOID');

-- AlterEnum
ALTER TYPE "BillItemType" ADD VALUE 'WATER';
ALTER TYPE "BillItemType" ADD VALUE 'POWER';
ALTER TYPE "BillItemType" ADD VALUE 'DEPOSIT';
ALTER TYPE "BillItemType" ADD VALUE 'MANAGEMENT';
ALTER TYPE "BillItemType" ADD VALUE 'NETWORK';

-- AlterTable
ALTER TABLE "Bill" ADD COLUMN "billingDate" TIMESTAMP(3);
ALTER TABLE "Bill" ADD COLUMN "mode" "BillMode" NOT NULL DEFAULT 'PREPAID';
ALTER TABLE "Bill" ADD COLUMN "monthlyBillId" TEXT;
UPDATE "Bill" SET "billingDate" = "periodStart" WHERE "billingDate" IS NULL;
ALTER TABLE "Bill" ALTER COLUMN "billingDate" SET NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "monthlyBillId" TEXT;
ALTER TABLE "Payment" ALTER COLUMN "billId" DROP NOT NULL;

-- DropIndex
DROP INDEX "Bill_leaseId_periodStart_key";

-- CreateTable
CREATE TABLE "MonthlyBill" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "tenantName" TEXT NOT NULL,
    "tenantPhone" TEXT NOT NULL,
    "billingDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'UNPAID',
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeterReading" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "apartmentId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "leaseId" TEXT,
    "meterType" "MeterType" NOT NULL,
    "readingDate" TIMESTAMP(3) NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "source" "MeterReadingSource" NOT NULL DEFAULT 'MANUAL',
    "status" "MeterReadingStatus" NOT NULL DEFAULT 'NORMAL',
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeterReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bill_leaseId_billingDate_mode_key" ON "Bill"("leaseId", "billingDate", "mode");

-- CreateIndex
CREATE INDEX "Bill_organizationId_status_idx" ON "Bill"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Bill_leaseId_billingDate_idx" ON "Bill"("leaseId", "billingDate");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyBill_leaseId_billingDate_key" ON "MonthlyBill"("leaseId", "billingDate");

-- CreateIndex
CREATE INDEX "MonthlyBill_organizationId_status_idx" ON "MonthlyBill"("organizationId", "status");

-- CreateIndex
CREATE INDEX "MeterReading_organizationId_roomId_meterType_readingDate_idx" ON "MeterReading"("organizationId", "roomId", "meterType", "readingDate");

-- CreateIndex
CREATE INDEX "MeterReading_leaseId_meterType_readingDate_idx" ON "MeterReading"("leaseId", "meterType", "readingDate");

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_monthlyBillId_fkey" FOREIGN KEY ("monthlyBillId") REFERENCES "MonthlyBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_monthlyBillId_fkey" FOREIGN KEY ("monthlyBillId") REFERENCES "MonthlyBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyBill" ADD CONSTRAINT "MonthlyBill_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyBill" ADD CONSTRAINT "MonthlyBill_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
