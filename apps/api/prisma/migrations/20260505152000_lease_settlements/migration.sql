-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'SETTLED');

-- CreateEnum
CREATE TYPE "SettlementPaymentDirection" AS ENUM ('RECEIVE', 'REFUND');

-- CreateTable
CREATE TABLE "LeaseSettlement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "type" "TerminationType" NOT NULL,
    "reason" TEXT,
    "terminatedAt" TIMESTAMP(3) NOT NULL,
    "depositAmount" DECIMAL(12,2) NOT NULL,
    "depositDeductionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "depositDeductionReason" TEXT,
    "depositRefundAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "rentAdjustmentAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "previousWater" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currentWater" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "previousPower" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currentPower" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "waterUnitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "powerUnitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "utilityAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherFeeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherFeeReason" TEXT,
    "receivableAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refundableAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaseSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementPayment" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "direction" "SettlementPaymentDirection" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "SettlementPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeaseSettlement_leaseId_key" ON "LeaseSettlement"("leaseId");

-- CreateIndex
CREATE INDEX "LeaseSettlement_organizationId_status_idx" ON "LeaseSettlement"("organizationId", "status");

-- CreateIndex
CREATE INDEX "LeaseSettlement_roomId_terminatedAt_idx" ON "LeaseSettlement"("roomId", "terminatedAt");

-- CreateIndex
CREATE INDEX "SettlementPayment_settlementId_paidAt_idx" ON "SettlementPayment"("settlementId", "paidAt");

-- AddForeignKey
ALTER TABLE "LeaseSettlement" ADD CONSTRAINT "LeaseSettlement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseSettlement" ADD CONSTRAINT "LeaseSettlement_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseSettlement" ADD CONSTRAINT "LeaseSettlement_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementPayment" ADD CONSTRAINT "SettlementPayment_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "LeaseSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementPayment" ADD CONSTRAINT "SettlementPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
