-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "expectedMoveInDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Reservation_expectedMoveInDate_idx" ON "Reservation"("expectedMoveInDate");
