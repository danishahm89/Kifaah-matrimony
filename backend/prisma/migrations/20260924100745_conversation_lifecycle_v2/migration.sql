/*
  Warnings:

  - You are about to drop the column `candidateId` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `label` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `score` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `text` on the `Notification` table. All the data in the column will be lost.
  - Added the required column `message` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Notification` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'CLOSED', 'REOPEN_REQUESTED', 'BLOCKED');

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "candidateId",
DROP COLUMN "label",
DROP COLUMN "score",
DROP COLUMN "text",
ADD COLUMN     "message" TEXT NOT NULL,
ADD COLUMN     "referenceId" TEXT,
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "interestId" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "reopenRequestedByUserId" TEXT,
    "reopenRequestedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedUser" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoAccessRequest" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotoAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaliShare" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "sharedByUserId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),

    CONSTRAINT "WaliShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "triggeredByUserId" TEXT,
    "type" TEXT NOT NULL,
    "conversationId" TEXT,
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_interestId_key" ON "Conversation"("interestId");

-- CreateIndex
CREATE INDEX "Conversation_status_closedAt_idx" ON "Conversation"("status", "closedAt");

-- CreateIndex
CREATE INDEX "BlockedUser_blockedId_idx" ON "BlockedUser"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedUser_blockerId_blockedId_key" ON "BlockedUser"("blockerId", "blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoAccessRequest_conversationId_requesterId_key" ON "PhotoAccessRequest"("conversationId", "requesterId");

-- CreateIndex
CREATE UNIQUE INDEX "WaliShare_accessToken_key" ON "WaliShare"("accessToken");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_interestId_fkey" FOREIGN KEY ("interestId") REFERENCES "InterestRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoAccessRequest" ADD CONSTRAINT "PhotoAccessRequest_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaliShare" ADD CONSTRAINT "WaliShare_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
