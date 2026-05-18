ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Message_deletedAt_idx"
  ON "Message"("deletedAt");
