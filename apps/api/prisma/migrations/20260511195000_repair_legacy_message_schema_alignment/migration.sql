DO $$
BEGIN
  CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'LISTING_CARD', 'OFFER', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'FILE';

ALTER TABLE "Conversation"
  ALTER COLUMN "buyerId" DROP NOT NULL,
  ALTER COLUMN "sellerId" DROP NOT NULL;

ALTER TABLE "ConversationParticipant"
  ALTER COLUMN "role" DROP NOT NULL,
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "body" TEXT,
  ADD COLUMN IF NOT EXISTS "type" "MessageType" NOT NULL DEFAULT 'TEXT',
  ADD COLUMN IF NOT EXISTS "encryptedBody" TEXT,
  ADD COLUMN IF NOT EXISTS "encryptedPayload" TEXT,
  ADD COLUMN IF NOT EXISTS "encryptionIv" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "encryptionAuthTag" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "listingId" TEXT,
  ADD COLUMN IF NOT EXISTS "offerAmount" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "offerCurrency" TEXT,
  ADD COLUMN IF NOT EXISTS "offerStatus" "OfferStatus";

ALTER TABLE "Message"
  ALTER COLUMN "body" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "MessageReadReceipt" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageReadReceipt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MessageReadReceipt_userId_idx"
  ON "MessageReadReceipt"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "MessageReadReceipt_messageId_userId_key"
  ON "MessageReadReceipt"("messageId", "userId");

DO $$
BEGIN
  ALTER TABLE "Message"
    ADD CONSTRAINT "Message_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "MessageReadReceipt"
    ADD CONSTRAINT "MessageReadReceipt_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "MessageReadReceipt"
    ADD CONSTRAINT "MessageReadReceipt_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
