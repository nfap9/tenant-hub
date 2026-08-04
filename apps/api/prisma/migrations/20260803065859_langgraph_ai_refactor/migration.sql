/*
  Warnings:

  - You are about to drop the column `messageId` on the `AiToolCall` table. All the data in the column will be lost.
  - You are about to drop the `AiMessage` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `conversationId` to the `AiToolCall` table without a default value. This is not possible if the table is not empty.
  - Added the required column `toolCallId` to the `AiToolCall` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "AiMessage" DROP CONSTRAINT "AiMessage_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "AiToolCall" DROP CONSTRAINT "AiToolCall_messageId_fkey";

-- DropIndex
DROP INDEX "AiToolCall_messageId_idx";

-- AlterTable
ALTER TABLE "AiToolCall" DROP COLUMN "messageId",
ADD COLUMN     "conversationId" TEXT NOT NULL,
ADD COLUMN     "toolCallId" TEXT NOT NULL;

-- DropTable
DROP TABLE "AiMessage";

-- DropEnum
DROP TYPE "AiRole";

-- CreateIndex
CREATE INDEX "AiToolCall_conversationId_createdAt_idx" ON "AiToolCall"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiToolCall" ADD CONSTRAINT "AiToolCall_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
