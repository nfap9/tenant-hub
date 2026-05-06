ALTER TABLE "User" ALTER COLUMN "passwordChangedAt" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "passwordChangedAt" DROP NOT NULL;

UPDATE "User"
SET "passwordChangedAt" = NULL;
