-- CreateEnum
CREATE TYPE "BillBillingMethod" AS ENUM ('AUTO', 'MANUAL');

-- AlterTable
ALTER TABLE "Bill" DROP COLUMN "category",
ADD COLUMN     "billingMethod" "BillBillingMethod" NOT NULL DEFAULT 'AUTO';
