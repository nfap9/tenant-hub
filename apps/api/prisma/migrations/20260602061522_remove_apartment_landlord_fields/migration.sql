/*
  Warnings:

  - You are about to drop the column `contractEnd` on the `Apartment` table. All the data in the column will be lost.
  - You are about to drop the column `contractStart` on the `Apartment` table. All the data in the column will be lost.
  - You are about to drop the column `depositAmount` on the `Apartment` table. All the data in the column will be lost.
  - You are about to drop the column `landlordContractNo` on the `Apartment` table. All the data in the column will be lost.
  - You are about to drop the column `landlordName` on the `Apartment` table. All the data in the column will be lost.
  - You are about to drop the column `landlordPhone` on the `Apartment` table. All the data in the column will be lost.
  - You are about to drop the column `paymentMethod` on the `Apartment` table. All the data in the column will be lost.
  - You are about to drop the column `rentAmount` on the `Apartment` table. All the data in the column will be lost.
  - You are about to drop the column `rentEscalationCycle` on the `Apartment` table. All the data in the column will be lost.
  - You are about to drop the column `rentEscalationType` on the `Apartment` table. All the data in the column will be lost.
  - You are about to drop the column `rentEscalationValue` on the `Apartment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Apartment" DROP COLUMN "contractEnd",
DROP COLUMN "contractStart",
DROP COLUMN "depositAmount",
DROP COLUMN "landlordContractNo",
DROP COLUMN "landlordName",
DROP COLUMN "landlordPhone",
DROP COLUMN "paymentMethod",
DROP COLUMN "rentAmount",
DROP COLUMN "rentEscalationCycle",
DROP COLUMN "rentEscalationType",
DROP COLUMN "rentEscalationValue";
