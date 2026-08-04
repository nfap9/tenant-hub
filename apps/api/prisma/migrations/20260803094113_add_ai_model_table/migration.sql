-- CreateTable
CREATE TABLE "AiModel" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerModel" TEXT NOT NULL,
    "baseURL" TEXT,
    "apiKey" TEXT,
    "maxTokens" INTEGER NOT NULL DEFAULT 4096,
    "contextWindowTokens" INTEGER NOT NULL DEFAULT 128000,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "tags" TEXT[] DEFAULT ARRAY['chat']::TEXT[],
    "costPerMtu" JSONB,
    "fallbackTo" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "authHeader" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiModel_pkey" PRIMARY KEY ("id")
);
