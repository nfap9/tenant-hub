-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('NONE', 'OPERATOR', 'ADMIN', 'SUPER_ADMIN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "platformRole" "PlatformRole" NOT NULL DEFAULT 'NONE';
