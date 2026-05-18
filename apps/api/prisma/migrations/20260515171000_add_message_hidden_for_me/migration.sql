CREATE TABLE IF NOT EXISTS "MessageHidden" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "hiddenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageHidden_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MessageHidden_messageId_userId_key"
  ON "MessageHidden"("messageId", "userId");

CREATE INDEX IF NOT EXISTS "MessageHidden_userId_hiddenAt_idx"
  ON "MessageHidden"("userId", "hiddenAt");

DO $$
BEGIN
  ALTER TABLE "MessageHidden"
    ADD CONSTRAINT "MessageHidden_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "MessageHidden"
    ADD CONSTRAINT "MessageHidden_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
