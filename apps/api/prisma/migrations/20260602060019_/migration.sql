-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('REGISTER', 'LOGIN', 'RESET_PASSWORD');

-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'INVITED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ApartmentStatus" AS ENUM ('PLANNING', 'RENOVATING', 'PREPARING', 'ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL_RENOVATED', 'URBAN_VILLAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "PropertyRight" AS ENUM ('OWNED', 'LONG_TERM_LEASE', 'TRUSTEESHIP');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('TO_RENOVATE', 'TO_CONFIGURE', 'VACANT', 'RESERVED', 'OCCUPIED', 'MAINTENANCE', 'CHECKOUT_CLEANING');

-- CreateEnum
CREATE TYPE "LeaseStatus" AS ENUM ('DRAFT', 'PENDING', 'ACTIVE', 'EXPIRING_SOON', 'TERMINATING', 'TERMINATED', 'EXPIRED', 'RENEWED');

-- CreateEnum
CREATE TYPE "RentCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "TerminationType" AS ENUM ('EXPIRED', 'NEGOTIATED', 'BREACH', 'FORCED');

-- CreateEnum
CREATE TYPE "CheckoutType" AS ENUM ('NORMAL', 'EARLY', 'FORCED', 'ROOM_CHANGE');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('DRAFT', 'BILLING', 'UNPAID', 'PARTIAL_PAID', 'PAID', 'OVERDUE', 'WRITTEN_OFF', 'REFUNDED', 'FAILED', 'VOID');

-- CreateEnum
CREATE TYPE "BillMode" AS ENUM ('PREPAID', 'POSTPAID', 'DEPOSIT');

-- CreateEnum
CREATE TYPE "BillType" AS ENUM ('MONTHLY', 'SETTLEMENT', 'DEPOSIT');

-- CreateEnum
CREATE TYPE "BillItemType" AS ENUM ('RENT', 'SERVICE_FEE', 'UTILITY', 'ELECTRICITY', 'WATER', 'POWER', 'GAS', 'CARRY_OVER', 'LATE_FEE', 'DEPOSIT', 'MANAGEMENT', 'SANITATION', 'ELEVATOR', 'PROPERTY', 'NETWORK', 'PENALTY', 'COMPENSATION', 'CLEANING_FEE', 'PREPAID_DEDUCTION', 'DISCOUNT', 'REFUND', 'OTHER');

-- CreateEnum
CREATE TYPE "MeterType" AS ENUM ('WATER', 'POWER', 'GAS');

-- CreateEnum
CREATE TYPE "MeterStatus" AS ENUM ('ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "MeterReadingSource" AS ENUM ('MANUAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "MeterReadingStatus" AS ENUM ('NORMAL', 'SUSPECTED', 'CONFIRMED', 'VOID');

-- CreateEnum
CREATE TYPE "MeterReadingType" AS ENUM ('MANUAL', 'SMART', 'CHECKIN', 'CHECKOUT');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('USER', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'SETTLED');

-- CreateEnum
CREATE TYPE "SettlementPaymentDirection" AS ENUM ('RECEIVE', 'REFUND');

-- CreateEnum
CREATE TYPE "SettlementItemType" AS ENUM ('RENT_ADJUSTMENT', 'UTILITY', 'DEPOSIT_REFUND', 'DEPOSIT_DEDUCTION', 'PENALTY', 'COMPENSATION', 'OTHER');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('UNPAID', 'PAID', 'PARTIAL_REFUNDED', 'FULLY_REFUNDED', 'DEDUCTED');

-- CreateEnum
CREATE TYPE "DepositLedgerType" AS ENUM ('COLLECT', 'DEDUCT', 'REFUND', 'TRANSFER');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('RECEIVE', 'REFUND', 'DEDUCT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillQueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED', 'SKIPPED', 'PAUSED');

-- CreateEnum
CREATE TYPE "AccountTransactionType" AS ENUM ('PAYMENT', 'CHARGE', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "AccountReferenceType" AS ENUM ('BILL', 'DEPOSIT', 'SETTLEMENT');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RefundType" AS ENUM ('DEPOSIT', 'PREPAID', 'OVERPAY');

-- CreateEnum
CREATE TYPE "MaintenanceOrderStatus" AS ENUM ('PENDING', 'DISPATCHED', 'IN_PROGRESS', 'AWAITING_ACCEPTANCE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MaintenanceOrderType" AS ENUM ('WATER_ELECTRIC', 'DOOR_WINDOW', 'WALL', 'FURNITURE_APPLIANCE', 'NETWORK', 'PIPE', 'CLEANING', 'OTHER');

-- CreateEnum
CREATE TYPE "MaintenancePriority" AS ENUM ('URGENT', 'NORMAL', 'LOW');

-- CreateEnum
CREATE TYPE "RoomCheckType" AS ENUM ('CHECKIN', 'CHECKOUT');

-- CreateEnum
CREATE TYPE "IncomeExpenseType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "CashierAccountType" AS ENUM ('CASH', 'BANK', 'WECHAT', 'ALIPAY', 'POS', 'OTHER');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'ISSUED', 'SENT', 'RECEIVED');

-- CreateEnum
CREATE TYPE "TenantSource" AS ENUM ('PLATFORM_58', 'DOUBAN', 'BEIKE', 'REFERRAL', 'AGENT', 'WALK_IN', 'OTHER');

-- CreateEnum
CREATE TYPE "Orientation" AS ENUM ('NORTH', 'SOUTH', 'EAST', 'WEST', 'NORTH_EAST', 'NORTH_WEST', 'SOUTH_EAST', 'SOUTH_WEST');

-- CreateEnum
CREATE TYPE "DecorationStatus" AS ENUM ('BARE', 'SIMPLE', 'DELUXE', 'LUXURY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "passwordChangedAt" TIMESTAMP(3),
    "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "status" "OrgStatus" NOT NULL DEFAULT 'ACTIVE',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "permissions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgInvite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "usedById" TEXT,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Apartment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "status" "ApartmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "statusReason" TEXT,
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "propertyType" "PropertyType" NOT NULL DEFAULT 'RESIDENTIAL',
    "floors" INTEGER NOT NULL,
    "landArea" DECIMAL(12,2),
    "totalArea" DECIMAL(12,2),
    "publicAreaRatio" DECIMAL(5,4),
    "buildYear" INTEGER,
    "elevatorCount" INTEGER NOT NULL DEFAULT 0,
    "propertyRight" "PropertyRight" NOT NULL DEFAULT 'LONG_TERM_LEASE',
    "landlordName" TEXT,
    "landlordPhone" TEXT,
    "landlordContractNo" TEXT,
    "contractStart" TIMESTAMP(3),
    "contractEnd" TIMESTAMP(3),
    "rentAmount" DECIMAL(12,2),
    "depositAmount" DECIMAL(12,2),
    "paymentMethod" TEXT,
    "rentEscalationType" TEXT,
    "rentEscalationValue" DECIMAL(10,4),
    "rentEscalationCycle" INTEGER,
    "costElectricityPrice" DECIMAL(10,4),
    "costWaterPrice" DECIMAL(10,4),
    "costGasPrice" DECIMAL(10,4),
    "reminderDay" INTEGER DEFAULT 3,
    "fireRating" TEXT,
    "fireExtinguisherCount" INTEGER,
    "escapeRouteCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Apartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandlordContract" (
    "id" TEXT NOT NULL,
    "apartmentId" TEXT NOT NULL,
    "contractNo" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "rentAmount" DECIMAL(12,2) NOT NULL,
    "depositAmount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "escalationType" TEXT,
    "escalationValue" DECIMAL(10,4),
    "escalationCycle" INTEGER,
    "freeRentDays" INTEGER NOT NULL DEFAULT 0,
    "freeRentStart" TIMESTAMP(3),
    "freeRentEnd" TIMESTAMP(3),
    "signDate" TIMESTAMP(3),
    "attachmentUrl" TEXT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LandlordContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandlordPayment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "landlordContractId" TEXT NOT NULL,
    "apartmentId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "plannedAmount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2),
    "paidAt" TIMESTAMP(3),
    "voucherNo" TEXT,
    "paymentMethod" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expenseId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LandlordPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApartmentExpense" (
    "id" TEXT NOT NULL,
    "apartmentId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "spentAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ApartmentExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "apartmentId" TEXT NOT NULL,
    "roomNo" TEXT NOT NULL,
    "floor" INTEGER NOT NULL DEFAULT 1,
    "layout" TEXT NOT NULL,
    "area" DECIMAL(10,2),
    "orientation" "Orientation",
    "decorationStatus" "DecorationStatus" NOT NULL DEFAULT 'SIMPLE',
    "decorationDate" TIMESTAMP(3),
    "facilities" TEXT[],
    "status" "RoomStatus" NOT NULL DEFAULT 'VACANT',
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusReason" TEXT,
    "currentRentPrice" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "idCard" TEXT,
    "idCardFrontUrl" TEXT,
    "idCardBackUrl" TEXT,
    "workUnit" TEXT,
    "jobTitle" TEXT,
    "emergencyContact" TEXT,
    "emergencyPhone" TEXT,
    "sourceChannel" "TenantSource" NOT NULL DEFAULT 'OTHER',
    "creditScore" INTEGER NOT NULL DEFAULT 100,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoResident" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "idCard" TEXT,
    "phone" TEXT,
    "relation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CoResident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lease" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "tenantId" TEXT,
    "tenantName" TEXT NOT NULL,
    "tenantPhone" TEXT NOT NULL,
    "contractDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "billDay" INTEGER DEFAULT 1,
    "utilityBillDay" INTEGER,
    "paymentDueDays" INTEGER NOT NULL DEFAULT 7,
    "graceDays" INTEGER NOT NULL DEFAULT 0,
    "cycle" "RentCycle" NOT NULL,
    "rentAmount" DECIMAL(12,2) NOT NULL,
    "monthlyServiceFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "depositMonths" INTEGER NOT NULL DEFAULT 1,
    "depositAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "waterUnitPrice" DECIMAL(10,2) NOT NULL,
    "powerUnitPrice" DECIMAL(10,2) NOT NULL,
    "gasUnitPrice" DECIMAL(10,2),
    "waterPricingTiers" JSONB,
    "powerPricingTiers" JSONB,
    "lateFeeRate" DECIMAL(10,6) NOT NULL DEFAULT 0.0005,
    "freeRentDays" INTEGER NOT NULL DEFAULT 0,
    "freeRentStart" TIMESTAMP(3),
    "freeRentEnd" TIMESTAMP(3),
    "rentEscalationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "nextEscalationDate" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "signedBy" TEXT,
    "remark" TEXT,
    "status" "LeaseStatus" NOT NULL DEFAULT 'ACTIVE',
    "terminationType" "TerminationType",
    "terminationReason" TEXT,
    "terminatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "parentLeaseId" TEXT,

    CONSTRAINT "Lease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaseFee" (
    "id" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "type" "BillItemType" NOT NULL DEFAULT 'OTHER',
    "name" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LeaseFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaseChangeLog" (
    "id" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaseChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaseSettlement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "billId" TEXT,
    "checkoutType" "CheckoutType",
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
    "previousGas" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currentGas" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "waterUnitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "powerUnitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "gasUnitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "utilityAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherFeeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherFeeReason" TEXT,
    "penaltyAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "penaltyReason" TEXT,
    "compensationAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "compensationReason" TEXT,
    "receivableAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refundableAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "tenantSignature" TEXT,
    "operatorSignature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LeaseSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementItem" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "type" "SettlementItemType" NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementItem_pkey" PRIMARY KEY ("id")
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
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SettlementPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deposit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "billId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deductedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "transferredAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "DepositStatus" NOT NULL DEFAULT 'UNPAID',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Deposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositLedger" (
    "id" TEXT NOT NULL,
    "depositId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "type" "DepositLedgerType" NOT NULL,
    "relatedBillId" TEXT,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "remark" TEXT,
    "operatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepositLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "mode" "BillMode" NOT NULL DEFAULT 'PREPAID',
    "type" "BillType" NOT NULL DEFAULT 'MONTHLY',
    "billingDate" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'UNPAID',
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillItem" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "type" "BillItemType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,4),
    "unitPrice" DECIMAL(10,4),
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "BillStatus" NOT NULL DEFAULT 'UNPAID',
    "previousWater" DECIMAL(12,2),
    "currentWater" DECIMAL(12,2),
    "previousPower" DECIMAL(12,2),
    "currentPower" DECIMAL(12,2),
    "previousGas" DECIMAL(12,2),
    "currentGas" DECIMAL(12,2),
    "waterUnitPrice" DECIMAL(10,2),
    "powerUnitPrice" DECIMAL(10,2),
    "gasUnitPrice" DECIMAL(10,2),
    "meterReadingId" TEXT,
    "note" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BillItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillItemReading" (
    "id" TEXT NOT NULL,
    "billItemId" TEXT NOT NULL,
    "meterType" "MeterType" NOT NULL,
    "previousValue" DECIMAL(12,2) NOT NULL,
    "currentValue" DECIMAL(12,2) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "usage" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "meterId" TEXT,
    "meterReadingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BillItemReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "billId" TEXT,
    "tenantId" TEXT,
    "userId" TEXT NOT NULL,
    "type" "PaymentType" NOT NULL DEFAULT 'RECEIVE',
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL,
    "transactionNo" TEXT,
    "note" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "allocatedAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OverduePenalty" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "baseAmount" DECIMAL(12,2) NOT NULL,
    "daysOverdue" INTEGER NOT NULL,
    "rate" DECIMAL(10,6) NOT NULL,
    "isWaived" BOOLEAN NOT NULL DEFAULT false,
    "waiveReason" TEXT,
    "waivedById" TEXT,
    "waivedAt" TIMESTAMP(3),
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OverduePenalty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tenantId" TEXT,
    "billId" TEXT,
    "title" TEXT NOT NULL,
    "taxNo" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "content" TEXT,
    "email" TEXT,
    "address" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "issuedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meter" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "apartmentId" TEXT NOT NULL,
    "roomId" TEXT,
    "name" TEXT NOT NULL,
    "meterType" "MeterType" NOT NULL,
    "meterNo" TEXT,
    "installDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removeDate" TIMESTAMP(3),
    "initialValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "MeterStatus" NOT NULL DEFAULT 'ACTIVE',
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Meter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeterReading" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "apartmentId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "leaseId" TEXT,
    "meterId" TEXT,
    "meterType" "MeterType" NOT NULL,
    "readingDate" TIMESTAMP(3) NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "usage" DECIMAL(12,2),
    "source" "MeterReadingSource" NOT NULL DEFAULT 'MANUAL',
    "readType" "MeterReadingType" NOT NULL DEFAULT 'MANUAL',
    "status" "MeterReadingStatus" NOT NULL DEFAULT 'NORMAL',
    "photoUrl" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MeterReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "apartmentId" TEXT,
    "roomId" TEXT,
    "type" "MaintenanceOrderType" NOT NULL,
    "priority" "MaintenancePriority" NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "reporterName" TEXT,
    "reporterPhone" TEXT,
    "scheduledDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "materialCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "laborCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "MaintenanceOrderStatus" NOT NULL DEFAULT 'PENDING',
    "assignedTo" TEXT,
    "acceptanceNote" TEXT,
    "beforePhotoUrl" TEXT,
    "afterPhotoUrl" TEXT,
    "isTenantFault" BOOLEAN NOT NULL DEFAULT false,
    "billItemId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MaintenanceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceOrderItem" (
    "id" TEXT NOT NULL,
    "maintenanceOrderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isLabor" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MaintenanceOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomChecklist" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "checkType" "RoomCheckType" NOT NULL,
    "checkDate" TIMESTAMP(3) NOT NULL,
    "checkedById" TEXT,
    "tenantSignUrl" TEXT,
    "operatorSignUrl" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomChecklistItem" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "description" TEXT,
    "photoUrl" TEXT,
    "deductionAmount" DECIMAL(12,2),
    "note" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RoomChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomeExpenseCategory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "IncomeExpenseType" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomeExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashierJournal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "IncomeExpenseType" NOT NULL,
    "categoryId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "accountType" "CashierAccountType" NOT NULL DEFAULT 'CASH',
    "counterparty" TEXT,
    "counterpartyId" TEXT,
    "relatedDocType" TEXT,
    "relatedDocId" TEXT,
    "relatedPaymentId" TEXT,
    "summary" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashierJournal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "prepaidBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "depositBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalUnpaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TenantAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountTransaction" (
    "id" TEXT NOT NULL,
    "tenantAccountId" TEXT NOT NULL,
    "type" "AccountTransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "referenceType" "AccountReferenceType",
    "referenceId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillQueue" (
    "id" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "nextBillDate" TIMESTAMP(3) NOT NULL,
    "lastBillDate" TIMESTAMP(3),
    "lastBillId" TEXT,
    "status" "BillQueueStatus" NOT NULL DEFAULT 'PENDING',
    "errorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apartmentLimit" INTEGER NOT NULL,
    "roomLimit" INTEGER NOT NULL,
    "memberLimit" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgQuotaPackage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "apartmentQuota" INTEGER NOT NULL DEFAULT 0,
    "roomQuota" INTEGER NOT NULL DEFAULT 0,
    "memberQuota" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgQuotaPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fieldName" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "userId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "bankName" TEXT,
    "accountNo" TEXT,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountTransfer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "RefundType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "approverId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "OtpCode_phone_purpose_idx" ON "OtpCode"("phone", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_code_key" ON "Organization"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "OrgMember_organizationId_userId_key" ON "OrgMember"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgInvite_code_key" ON "OrgInvite"("code");

-- CreateIndex
CREATE INDEX "OrgInvite_organizationId_createdAt_idx" ON "OrgInvite"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "OrgInvite_code_expiresAt_idx" ON "OrgInvite"("code", "expiresAt");

-- CreateIndex
CREATE INDEX "Apartment_organizationId_status_idx" ON "Apartment"("organizationId", "status");

-- CreateIndex
CREATE INDEX "LandlordContract_apartmentId_isActive_idx" ON "LandlordContract"("apartmentId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LandlordPayment_expenseId_key" ON "LandlordPayment"("expenseId");

-- CreateIndex
CREATE INDEX "LandlordPayment_organizationId_status_idx" ON "LandlordPayment"("organizationId", "status");

-- CreateIndex
CREATE INDEX "LandlordPayment_landlordContractId_dueDate_idx" ON "LandlordPayment"("landlordContractId", "dueDate");

-- CreateIndex
CREATE INDEX "LandlordPayment_apartmentId_status_idx" ON "LandlordPayment"("apartmentId", "status");

-- CreateIndex
CREATE INDEX "ApartmentExpense_apartmentId_spentAt_idx" ON "ApartmentExpense"("apartmentId", "spentAt");

-- CreateIndex
CREATE INDEX "Room_apartmentId_status_idx" ON "Room"("apartmentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Room_apartmentId_roomNo_key" ON "Room"("apartmentId", "roomNo");

-- CreateIndex
CREATE INDEX "Tenant_organizationId_name_idx" ON "Tenant"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_organizationId_phone_key" ON "Tenant"("organizationId", "phone");

-- CreateIndex
CREATE INDEX "CoResident_tenantId_idx" ON "CoResident"("tenantId");

-- CreateIndex
CREATE INDEX "CoResident_leaseId_idx" ON "CoResident"("leaseId");

-- CreateIndex
CREATE INDEX "Lease_roomId_status_idx" ON "Lease"("roomId", "status");

-- CreateIndex
CREATE INDEX "Lease_tenantId_status_idx" ON "Lease"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Lease_organizationId_status_idx" ON "Lease"("organizationId", "status");

-- CreateIndex
CREATE INDEX "LeaseChangeLog_leaseId_changedAt_idx" ON "LeaseChangeLog"("leaseId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeaseSettlement_leaseId_key" ON "LeaseSettlement"("leaseId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaseSettlement_billId_key" ON "LeaseSettlement"("billId");

-- CreateIndex
CREATE INDEX "LeaseSettlement_organizationId_status_idx" ON "LeaseSettlement"("organizationId", "status");

-- CreateIndex
CREATE INDEX "LeaseSettlement_roomId_terminatedAt_idx" ON "LeaseSettlement"("roomId", "terminatedAt");

-- CreateIndex
CREATE INDEX "SettlementItem_settlementId_idx" ON "SettlementItem"("settlementId");

-- CreateIndex
CREATE INDEX "SettlementPayment_settlementId_paidAt_idx" ON "SettlementPayment"("settlementId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_leaseId_key" ON "Deposit"("leaseId");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_billId_key" ON "Deposit"("billId");

-- CreateIndex
CREATE INDEX "Deposit_organizationId_status_idx" ON "Deposit"("organizationId", "status");

-- CreateIndex
CREATE INDEX "DepositLedger_depositId_createdAt_idx" ON "DepositLedger"("depositId", "createdAt");

-- CreateIndex
CREATE INDEX "DepositLedger_leaseId_createdAt_idx" ON "DepositLedger"("leaseId", "createdAt");

-- CreateIndex
CREATE INDEX "DepositLedger_tenantId_createdAt_idx" ON "DepositLedger"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Bill_organizationId_status_idx" ON "Bill"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Bill_leaseId_billingDate_idx" ON "Bill"("leaseId", "billingDate");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_leaseId_billingDate_mode_key" ON "Bill"("leaseId", "billingDate", "mode");

-- CreateIndex
CREATE INDEX "BillItem_billId_type_idx" ON "BillItem"("billId", "type");

-- CreateIndex
CREATE INDEX "BillItemReading_billItemId_idx" ON "BillItemReading"("billItemId");

-- CreateIndex
CREATE INDEX "Payment_billId_paidAt_idx" ON "Payment"("billId", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_tenantId_paidAt_idx" ON "Payment"("tenantId", "paidAt");

-- CreateIndex
CREATE INDEX "PaymentAllocation_paymentId_idx" ON "PaymentAllocation"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_billId_idx" ON "PaymentAllocation"("billId");

-- CreateIndex
CREATE INDEX "OverduePenalty_billId_idx" ON "OverduePenalty"("billId");

-- CreateIndex
CREATE INDEX "OverduePenalty_leaseId_idx" ON "OverduePenalty"("leaseId");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_status_idx" ON "Invoice"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_idx" ON "Invoice"("tenantId");

-- CreateIndex
CREATE INDEX "Meter_organizationId_apartmentId_idx" ON "Meter"("organizationId", "apartmentId");

-- CreateIndex
CREATE INDEX "Meter_roomId_status_idx" ON "Meter"("roomId", "status");

-- CreateIndex
CREATE INDEX "MeterReading_organizationId_roomId_meterType_readingDate_idx" ON "MeterReading"("organizationId", "roomId", "meterType", "readingDate");

-- CreateIndex
CREATE INDEX "MeterReading_leaseId_meterType_readingDate_idx" ON "MeterReading"("leaseId", "meterType", "readingDate");

-- CreateIndex
CREATE INDEX "MeterReading_meterId_readingDate_idx" ON "MeterReading"("meterId", "readingDate");

-- CreateIndex
CREATE INDEX "MaintenanceOrder_organizationId_status_idx" ON "MaintenanceOrder"("organizationId", "status");

-- CreateIndex
CREATE INDEX "MaintenanceOrder_roomId_status_idx" ON "MaintenanceOrder"("roomId", "status");

-- CreateIndex
CREATE INDEX "MaintenanceOrder_priority_status_idx" ON "MaintenanceOrder"("priority", "status");

-- CreateIndex
CREATE INDEX "MaintenanceOrderItem_maintenanceOrderId_idx" ON "MaintenanceOrderItem"("maintenanceOrderId");

-- CreateIndex
CREATE INDEX "RoomChecklist_leaseId_checkType_idx" ON "RoomChecklist"("leaseId", "checkType");

-- CreateIndex
CREATE INDEX "RoomChecklist_roomId_checkType_idx" ON "RoomChecklist"("roomId", "checkType");

-- CreateIndex
CREATE INDEX "RoomChecklistItem_checklistId_idx" ON "RoomChecklistItem"("checklistId");

-- CreateIndex
CREATE INDEX "IncomeExpenseCategory_organizationId_type_idx" ON "IncomeExpenseCategory"("organizationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "IncomeExpenseCategory_organizationId_code_key" ON "IncomeExpenseCategory"("organizationId", "code");

-- CreateIndex
CREATE INDEX "CashierJournal_organizationId_date_idx" ON "CashierJournal"("organizationId", "date");

-- CreateIndex
CREATE INDEX "CashierJournal_organizationId_type_date_idx" ON "CashierJournal"("organizationId", "type", "date");

-- CreateIndex
CREATE INDEX "CashierJournal_counterpartyId_date_idx" ON "CashierJournal"("counterpartyId", "date");

-- CreateIndex
CREATE INDEX "CashierJournal_relatedDocType_relatedDocId_idx" ON "CashierJournal"("relatedDocType", "relatedDocId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantAccount_tenantId_key" ON "TenantAccount"("tenantId");

-- CreateIndex
CREATE INDEX "AccountTransaction_tenantAccountId_createdAt_idx" ON "AccountTransaction"("tenantAccountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillQueue_leaseId_key" ON "BillQueue"("leaseId");

-- CreateIndex
CREATE INDEX "BillQueue_nextBillDate_status_idx" ON "BillQueue"("nextBillDate", "status");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_tableName_recordId_idx" ON "AuditLog"("organizationId", "tableName", "recordId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE INDEX "Notification_organizationId_userId_readAt_idx" ON "Notification"("organizationId", "userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Account_organizationId_idx" ON "Account"("organizationId");

-- CreateIndex
CREATE INDEX "AccountTransfer_organizationId_createdAt_idx" ON "AccountTransfer"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Refund_organizationId_status_idx" ON "Refund"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Refund_tenantId_idx" ON "Refund"("tenantId");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgInvite" ADD CONSTRAINT "OrgInvite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgInvite" ADD CONSTRAINT "OrgInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgInvite" ADD CONSTRAINT "OrgInvite_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Apartment" ADD CONSTRAINT "Apartment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandlordContract" ADD CONSTRAINT "LandlordContract_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandlordPayment" ADD CONSTRAINT "LandlordPayment_landlordContractId_fkey" FOREIGN KEY ("landlordContractId") REFERENCES "LandlordContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandlordPayment" ADD CONSTRAINT "LandlordPayment_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandlordPayment" ADD CONSTRAINT "LandlordPayment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "ApartmentExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApartmentExpense" ADD CONSTRAINT "ApartmentExpense_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApartmentExpense" ADD CONSTRAINT "ApartmentExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "IncomeExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoResident" ADD CONSTRAINT "CoResident_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoResident" ADD CONSTRAINT "CoResident_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_parentLeaseId_fkey" FOREIGN KEY ("parentLeaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseFee" ADD CONSTRAINT "LeaseFee_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseChangeLog" ADD CONSTRAINT "LeaseChangeLog_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseSettlement" ADD CONSTRAINT "LeaseSettlement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseSettlement" ADD CONSTRAINT "LeaseSettlement_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseSettlement" ADD CONSTRAINT "LeaseSettlement_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseSettlement" ADD CONSTRAINT "LeaseSettlement_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementItem" ADD CONSTRAINT "SettlementItem_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "LeaseSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementPayment" ADD CONSTRAINT "SettlementPayment_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "LeaseSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementPayment" ADD CONSTRAINT "SettlementPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositLedger" ADD CONSTRAINT "DepositLedger_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "Deposit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositLedger" ADD CONSTRAINT "DepositLedger_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositLedger" ADD CONSTRAINT "DepositLedger_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositLedger" ADD CONSTRAINT "DepositLedger_relatedBillId_fkey" FOREIGN KEY ("relatedBillId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositLedger" ADD CONSTRAINT "DepositLedger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_meterReadingId_fkey" FOREIGN KEY ("meterReadingId") REFERENCES "MeterReading"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItemReading" ADD CONSTRAINT "BillItemReading_billItemId_fkey" FOREIGN KEY ("billItemId") REFERENCES "BillItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItemReading" ADD CONSTRAINT "BillItemReading_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "Meter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItemReading" ADD CONSTRAINT "BillItemReading_meterReadingId_fkey" FOREIGN KEY ("meterReadingId") REFERENCES "MeterReading"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OverduePenalty" ADD CONSTRAINT "OverduePenalty_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meter" ADD CONSTRAINT "Meter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meter" ADD CONSTRAINT "Meter_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meter" ADD CONSTRAINT "Meter_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meter" ADD CONSTRAINT "Meter_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Meter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "Meter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceOrder" ADD CONSTRAINT "MaintenanceOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceOrder" ADD CONSTRAINT "MaintenanceOrder_apartmentId_fkey" FOREIGN KEY ("apartmentId") REFERENCES "Apartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceOrder" ADD CONSTRAINT "MaintenanceOrder_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceOrder" ADD CONSTRAINT "MaintenanceOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceOrderItem" ADD CONSTRAINT "MaintenanceOrderItem_maintenanceOrderId_fkey" FOREIGN KEY ("maintenanceOrderId") REFERENCES "MaintenanceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomChecklist" ADD CONSTRAINT "RoomChecklist_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomChecklist" ADD CONSTRAINT "RoomChecklist_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomChecklist" ADD CONSTRAINT "RoomChecklist_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomChecklistItem" ADD CONSTRAINT "RoomChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "RoomChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeExpenseCategory" ADD CONSTRAINT "IncomeExpenseCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeExpenseCategory" ADD CONSTRAINT "IncomeExpenseCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "IncomeExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierJournal" ADD CONSTRAINT "CashierJournal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierJournal" ADD CONSTRAINT "CashierJournal_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAccount" ADD CONSTRAINT "TenantAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransaction" ADD CONSTRAINT "AccountTransaction_tenantAccountId_fkey" FOREIGN KEY ("tenantAccountId") REFERENCES "TenantAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillQueue" ADD CONSTRAINT "BillQueue_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgQuotaPackage" ADD CONSTRAINT "OrgQuotaPackage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransfer" ADD CONSTRAINT "AccountTransfer_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
