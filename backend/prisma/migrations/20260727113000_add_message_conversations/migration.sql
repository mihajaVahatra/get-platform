-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "directKey" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_participants" (
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("conversationId", "userId")
);

-- AlterTable
ALTER TABLE "messages" ADD COLUMN "conversationId" TEXT;

-- Backfill one direct conversation for every existing sender/recipient pair.
WITH direct_messages AS (
    SELECT
      LEAST("senderId", "recipientId") || ':' || GREATEST("senderId", "recipientId") AS "directKey",
      MIN("createdAt") AS "createdAt",
      MAX("createdAt") AS "lastMessageAt"
    FROM "messages"
    GROUP BY LEAST("senderId", "recipientId"), GREATEST("senderId", "recipientId")
)
INSERT INTO "conversations" ("id", "directKey", "createdAt", "lastMessageAt")
SELECT md5('conversation:' || "directKey"), "directKey", "createdAt", "lastMessageAt"
FROM direct_messages;

INSERT INTO "conversation_participants" ("conversationId", "userId")
SELECT md5('conversation:' || LEAST("senderId", "recipientId") || ':' || GREATEST("senderId", "recipientId")), "senderId"
FROM "messages"
UNION
SELECT md5('conversation:' || LEAST("senderId", "recipientId") || ':' || GREATEST("senderId", "recipientId")), "recipientId"
FROM "messages";

UPDATE "messages"
SET "conversationId" = md5('conversation:' || LEAST("senderId", "recipientId") || ':' || GREATEST("senderId", "recipientId"));

ALTER TABLE "messages" ALTER COLUMN "conversationId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "conversations_directKey_key" ON "conversations"("directKey");
CREATE INDEX "conversations_lastMessageAt_idx" ON "conversations"("lastMessageAt");
CREATE INDEX "conversation_participants_userId_conversationId_idx" ON "conversation_participants"("userId", "conversationId");
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
