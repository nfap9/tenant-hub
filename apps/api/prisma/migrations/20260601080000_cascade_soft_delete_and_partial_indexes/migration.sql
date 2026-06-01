-- =============================================
-- 重构：软删除级联触发器 + Partial Index
-- =============================================

-- 1. 修复 Organization.ownerId 外键关系（如果尚未存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Organization_ownerId_fkey'
    AND table_name = 'Organization'
  ) THEN
    ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 2. 级联软删除触发器函数
CREATE OR REPLACE FUNCTION cascade_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- apartments 级联到子表
  IF TG_TABLE_NAME = 'Apartment' THEN
    UPDATE "Room" SET "deletedAt" = NEW."deletedAt"
    WHERE "apartmentId" = NEW.id AND "deletedAt" IS DISTINCT FROM NEW."deletedAt";

    UPDATE "Meter" SET "deletedAt" = NEW."deletedAt"
    WHERE "apartmentId" = NEW.id AND "deletedAt" IS DISTINCT FROM NEW."deletedAt";

    UPDATE "MeterReading" SET "deletedAt" = NEW."deletedAt"
    WHERE "apartmentId" = NEW.id AND "deletedAt" IS DISTINCT FROM NEW."deletedAt";

    UPDATE "MaintenanceOrder" SET "deletedAt" = NEW."deletedAt"
    WHERE "apartmentId" = NEW.id AND "deletedAt" IS DISTINCT FROM NEW."deletedAt";

    UPDATE "LandlordContract" SET "deletedAt" = NEW."deletedAt"
    WHERE "apartmentId" = NEW.id AND "deletedAt" IS DISTINCT FROM NEW."deletedAt";

    UPDATE "ApartmentExpense" SET "deletedAt" = NEW."deletedAt"
    WHERE "apartmentId" = NEW.id AND "deletedAt" IS DISTINCT FROM NEW."deletedAt";
  END IF;

  -- rooms 级联到子表
  IF TG_TABLE_NAME = 'Room' THEN
    UPDATE "Meter" SET "deletedAt" = NEW."deletedAt"
    WHERE "roomId" = NEW.id AND "deletedAt" IS DISTINCT FROM NEW."deletedAt";

    UPDATE "MeterReading" SET "deletedAt" = NEW."deletedAt"
    WHERE "roomId" = NEW.id AND "deletedAt" IS DISTINCT FROM NEW."deletedAt";

    UPDATE "MaintenanceOrder" SET "deletedAt" = NEW."deletedAt"
    WHERE "roomId" = NEW.id AND "deletedAt" IS DISTINCT FROM NEW."deletedAt";
  END IF;

  -- leases 级联到子表
  IF TG_TABLE_NAME = 'Lease' THEN
    UPDATE "Bill" SET "deletedAt" = NEW."deletedAt"
    WHERE "leaseId" = NEW.id AND "deletedAt" IS DISTINCT FROM NEW."deletedAt";

    UPDATE "LeaseFee" SET "deletedAt" = NEW."deletedAt"
    WHERE "leaseId" = NEW.id AND "deletedAt" IS DISTINCT FROM NEW."deletedAt";

    UPDATE "DepositLedger" SET "deletedAt" = NEW."deletedAt"
    WHERE "leaseId" = NEW.id AND "deletedAt" IS DISTINCT FROM NEW."deletedAt";

    UPDATE "MeterReading" SET "deletedAt" = NEW."deletedAt"
    WHERE "leaseId" = NEW.id AND "deletedAt" IS DISTINCT FROM NEW."deletedAt";

    UPDATE "CoResident" SET "deletedAt" = NEW."deletedAt"
    WHERE "leaseId" = NEW.id AND "deletedAt" IS DISTINCT FROM NEW."deletedAt";
  END IF;

  -- bills 级联到子表
  IF TG_TABLE_NAME = 'Bill' THEN
    UPDATE "BillItem" SET "deletedAt" = NEW."deletedAt"
    WHERE "billId" = NEW.id AND "deletedAt" IS DISTINCT FROM NEW."deletedAt";

    UPDATE "Payment" SET "deletedAt" = NEW."deletedAt"
    WHERE "billId" = NEW.id AND "deletedAt" IS DISTINCT FROM NEW."deletedAt";

    UPDATE "Invoice" SET "deletedAt" = NEW."deletedAt"
    WHERE "billId" = NEW.id AND "deletedAt" IS DISTINCT FROM NEW."deletedAt";
  END IF;

  -- billItems 级联到子表
  IF TG_TABLE_NAME = 'BillItem' THEN
    UPDATE "BillItemReading" SET "deletedAt" = NEW."deletedAt"
    WHERE "billItemId" = NEW.id AND "deletedAt" IS DISTINCT FROM NEW."deletedAt";
  END IF;

  -- tenants 级联到子表
  IF TG_TABLE_NAME = 'Tenant' THEN
    UPDATE "TenantAccount" SET "deletedAt" = NEW."deletedAt"
    WHERE "tenantId" = NEW.id AND "deletedAt" IS DISTINCT FROM NEW."deletedAt";

    UPDATE "DepositLedger" SET "deletedAt" = NEW."deletedAt"
    WHERE "tenantId" = NEW.id AND "deletedAt" IS DISTINCT FROM NEW."deletedAt";
  END IF;

  -- landlordContracts 级联到子表
  IF TG_TABLE_NAME = 'LandlordContract' THEN
    UPDATE "LandlordPayment" SET "deletedAt" = NEW."deletedAt"
    WHERE "landlordContractId" = NEW.id AND "deletedAt" IS DISTINCT FROM NEW."deletedAt";
  END IF;

  -- deposits 级联到子表
  IF TG_TABLE_NAME = 'Deposit' THEN
    UPDATE "DepositLedger" SET "deletedAt" = NEW."deletedAt"
    WHERE "depositId" = NEW.id AND "deletedAt" IS DISTINCT FROM NEW."deletedAt";
  END IF;

  -- maintenanceOrders 级联到子表
  IF TG_TABLE_NAME = 'MaintenanceOrder' THEN
    UPDATE "MaintenanceOrderItem" SET "deletedAt" = NEW."deletedAt"
    WHERE "maintenanceOrderId" = NEW.id AND "deletedAt" IS DISTINCT FROM NEW."deletedAt";
  END IF;

  -- roomChecklists 级联到子表
  IF TG_TABLE_NAME = 'RoomChecklist' THEN
    UPDATE "RoomChecklistItem" SET "deletedAt" = NEW."deletedAt"
    WHERE "checklistId" = NEW.id AND "deletedAt" IS DISTINCT FROM NEW."deletedAt";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. 绑定触发器（先删除已存在的同名触发器，再创建）
DROP TRIGGER IF EXISTS trg_apartment_soft_delete ON "Apartment";
CREATE TRIGGER trg_apartment_soft_delete
AFTER UPDATE OF "deletedAt" ON "Apartment"
FOR EACH ROW
WHEN (OLD."deletedAt" IS DISTINCT FROM NEW."deletedAt")
EXECUTE FUNCTION cascade_soft_delete();

DROP TRIGGER IF EXISTS trg_room_soft_delete ON "Room";
CREATE TRIGGER trg_room_soft_delete
AFTER UPDATE OF "deletedAt" ON "Room"
FOR EACH ROW
WHEN (OLD."deletedAt" IS DISTINCT FROM NEW."deletedAt")
EXECUTE FUNCTION cascade_soft_delete();

DROP TRIGGER IF EXISTS trg_lease_soft_delete ON "Lease";
CREATE TRIGGER trg_lease_soft_delete
AFTER UPDATE OF "deletedAt" ON "Lease"
FOR EACH ROW
WHEN (OLD."deletedAt" IS DISTINCT FROM NEW."deletedAt")
EXECUTE FUNCTION cascade_soft_delete();

DROP TRIGGER IF EXISTS trg_bill_soft_delete ON "Bill";
CREATE TRIGGER trg_bill_soft_delete
AFTER UPDATE OF "deletedAt" ON "Bill"
FOR EACH ROW
WHEN (OLD."deletedAt" IS DISTINCT FROM NEW."deletedAt")
EXECUTE FUNCTION cascade_soft_delete();

DROP TRIGGER IF EXISTS trg_bill_item_soft_delete ON "BillItem";
CREATE TRIGGER trg_bill_item_soft_delete
AFTER UPDATE OF "deletedAt" ON "BillItem"
FOR EACH ROW
WHEN (OLD."deletedAt" IS DISTINCT FROM NEW."deletedAt")
EXECUTE FUNCTION cascade_soft_delete();

DROP TRIGGER IF EXISTS trg_tenant_soft_delete ON "Tenant";
CREATE TRIGGER trg_tenant_soft_delete
AFTER UPDATE OF "deletedAt" ON "Tenant"
FOR EACH ROW
WHEN (OLD."deletedAt" IS DISTINCT FROM NEW."deletedAt")
EXECUTE FUNCTION cascade_soft_delete();

DROP TRIGGER IF EXISTS trg_landlord_contract_soft_delete ON "LandlordContract";
CREATE TRIGGER trg_landlord_contract_soft_delete
AFTER UPDATE OF "deletedAt" ON "LandlordContract"
FOR EACH ROW
WHEN (OLD."deletedAt" IS DISTINCT FROM NEW."deletedAt")
EXECUTE FUNCTION cascade_soft_delete();

DROP TRIGGER IF EXISTS trg_deposit_soft_delete ON "Deposit";
CREATE TRIGGER trg_deposit_soft_delete
AFTER UPDATE OF "deletedAt" ON "Deposit"
FOR EACH ROW
WHEN (OLD."deletedAt" IS DISTINCT FROM NEW."deletedAt")
EXECUTE FUNCTION cascade_soft_delete();

DROP TRIGGER IF EXISTS trg_maintenance_order_soft_delete ON "MaintenanceOrder";
CREATE TRIGGER trg_maintenance_order_soft_delete
AFTER UPDATE OF "deletedAt" ON "MaintenanceOrder"
FOR EACH ROW
WHEN (OLD."deletedAt" IS DISTINCT FROM NEW."deletedAt")
EXECUTE FUNCTION cascade_soft_delete();

DROP TRIGGER IF EXISTS trg_room_checklist_soft_delete ON "RoomChecklist";
CREATE TRIGGER trg_room_checklist_soft_delete
AFTER UPDATE OF "deletedAt" ON "RoomChecklist"
FOR EACH ROW
WHEN (OLD."deletedAt" IS DISTINCT FROM NEW."deletedAt")
EXECUTE FUNCTION cascade_soft_delete();

-- 4. Partial Index（仅索引未删除数据，提升查询性能）
-- Apartment
CREATE INDEX IF NOT EXISTS "idx_apartment_active" ON "Apartment"("organizationId", "status") WHERE "deletedAt" IS NULL;

-- Room
CREATE INDEX IF NOT EXISTS "idx_room_active" ON "Room"("apartmentId", "status") WHERE "deletedAt" IS NULL;

-- Lease
CREATE INDEX IF NOT EXISTS "idx_lease_active" ON "Lease"("organizationId", "status", "endDate") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_lease_room_active" ON "Lease"("roomId", "status") WHERE "deletedAt" IS NULL;

-- Bill
CREATE INDEX IF NOT EXISTS "idx_bill_active" ON "Bill"("organizationId", "status", "dueDate") WHERE "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_bill_lease_active" ON "Bill"("leaseId", "billingDate") WHERE "deletedAt" IS NULL;

-- BillItem
CREATE INDEX IF NOT EXISTS "idx_bill_item_active" ON "BillItem"("billId", "type") WHERE "deletedAt" IS NULL;

-- Tenant
CREATE INDEX IF NOT EXISTS "idx_tenant_active" ON "Tenant"("organizationId", "name") WHERE "deletedAt" IS NULL;

-- MeterReading
CREATE INDEX IF NOT EXISTS "idx_meter_reading_active" ON "MeterReading"("organizationId", "roomId", "meterType", "readingDate") WHERE "deletedAt" IS NULL;

-- MaintenanceOrder
CREATE INDEX IF NOT EXISTS "idx_maintenance_active" ON "MaintenanceOrder"("organizationId", "status") WHERE "deletedAt" IS NULL;

-- DepositLedger
CREATE INDEX IF NOT EXISTS "idx_deposit_ledger_active" ON "DepositLedger"("depositId", "createdAt") WHERE "deletedAt" IS NULL;

-- ApartmentExpense
CREATE INDEX IF NOT EXISTS "idx_apartment_expense_active" ON "ApartmentExpense"("apartmentId", "spentAt") WHERE "deletedAt" IS NULL;
