DO $$
BEGIN
  CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'RESOLVED', 'DISMISSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ConversationParticipant"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "UserBlock" (
  "id" TEXT NOT NULL,
  "blockerId" TEXT NOT NULL,
  "blockedUserId" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserBlock_blockerId_blockedUserId_key"
  ON "UserBlock"("blockerId", "blockedUserId");
CREATE INDEX IF NOT EXISTS "UserBlock_blockedUserId_idx"
  ON "UserBlock"("blockedUserId");

DO $$
BEGIN
  ALTER TABLE "UserBlock"
    ADD CONSTRAINT "UserBlock_blockerId_fkey"
    FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "UserBlock"
    ADD CONSTRAINT "UserBlock_blockedUserId_fkey"
    FOREIGN KEY ("blockedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ConversationReport" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "details" TEXT,
  "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ConversationReport_conversationId_createdAt_idx"
  ON "ConversationReport"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "ConversationReport_reporterId_createdAt_idx"
  ON "ConversationReport"("reporterId", "createdAt");
CREATE INDEX IF NOT EXISTS "ConversationReport_status_createdAt_idx"
  ON "ConversationReport"("status", "createdAt");

DO $$
BEGIN
  ALTER TABLE "ConversationReport"
    ADD CONSTRAINT "ConversationReport_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ConversationReport"
    ADD CONSTRAINT "ConversationReport_reporterId_fkey"
    FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MessageReport" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "details" TEXT,
  "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MessageReport_messageId_createdAt_idx"
  ON "MessageReport"("messageId", "createdAt");
CREATE INDEX IF NOT EXISTS "MessageReport_reporterId_createdAt_idx"
  ON "MessageReport"("reporterId", "createdAt");
CREATE INDEX IF NOT EXISTS "MessageReport_status_createdAt_idx"
  ON "MessageReport"("status", "createdAt");

DO $$
BEGIN
  ALTER TABLE "MessageReport"
    ADD CONSTRAINT "MessageReport_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "MessageReport"
    ADD CONSTRAINT "MessageReport_reporterId_fkey"
    FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
