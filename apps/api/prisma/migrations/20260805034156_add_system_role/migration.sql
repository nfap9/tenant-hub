-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('SYSTEM_ADMIN', 'OPERATOR');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "systemRole" "SystemRole";
