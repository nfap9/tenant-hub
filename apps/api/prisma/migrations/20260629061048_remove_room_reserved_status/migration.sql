/*
  Warnings:

  - The values [RESERVED] on the enum `RoomStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;

-- Migrate existing RESERVED rooms to VACANT before removing the enum value
UPDATE "Room" SET "status" = 'VACANT' WHERE "status" = 'RESERVED';

CREATE TYPE "RoomStatus_new" AS ENUM ('VACANT', 'OCCUPIED', 'MAINTENANCE', 'SELF_USE');
ALTER TABLE "Room" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Room" ALTER COLUMN "status" TYPE "RoomStatus_new" USING ("status"::text::"RoomStatus_new");
ALTER TYPE "RoomStatus" RENAME TO "RoomStatus_old";
ALTER TYPE "RoomStatus_new" RENAME TO "RoomStatus";
DROP TYPE "RoomStatus_old";
ALTER TABLE "Room" ALTER COLUMN "status" SET DEFAULT 'VACANT';
COMMIT;
