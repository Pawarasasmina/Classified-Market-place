DO $$
BEGIN
  CREATE TYPE "BoostPlacement" AS ENUM ('FEATURED', 'SEARCH_TOP', 'CATEGORY_TOP');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "BoostStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'EXPIRED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TransactionType" AS ENUM ('BOOST_PURCHASE', 'LISTING_FEE', 'REFUND');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "MediaAssetType" AS ENUM ('IMAGE', 'VIDEO', 'FILE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "NotificationType" AS ENUM ('SYSTEM', 'LISTING', 'MESSAGE', 'OFFER', 'BOOST', 'TRANSACTION', 'REPORT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Transaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "listingId" TEXT,
  "type" "TransactionType" NOT NULL,
  "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AED',
  "provider" TEXT,
  "providerRef" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_provider_providerRef_key"
  ON "Transaction"("provider", "providerRef");
CREATE INDEX IF NOT EXISTS "Transaction_userId_createdAt_idx"
  ON "Transaction"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Transaction_listingId_idx"
  ON "Transaction"("listingId");
CREATE INDEX IF NOT EXISTS "Transaction_status_createdAt_idx"
  ON "Transaction"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Transaction_type_createdAt_idx"
  ON "Transaction"("type", "createdAt");

DO $$
BEGIN
  ALTER TABLE "Transaction"
    ADD CONSTRAINT "Transaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Transaction"
    ADD CONSTRAINT "Transaction_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Boost" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "purchaserId" TEXT NOT NULL,
  "transactionId" TEXT,
  "placement" "BoostPlacement" NOT NULL DEFAULT 'FEATURED',
  "status" "BoostStatus" NOT NULL DEFAULT 'SCHEDULED',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Boost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Boost_listingId_status_idx"
  ON "Boost"("listingId", "status");
CREATE INDEX IF NOT EXISTS "Boost_purchaserId_createdAt_idx"
  ON "Boost"("purchaserId", "createdAt");
CREATE INDEX IF NOT EXISTS "Boost_status_startsAt_endsAt_idx"
  ON "Boost"("status", "startsAt", "endsAt");
CREATE INDEX IF NOT EXISTS "Boost_transactionId_idx"
  ON "Boost"("transactionId");

DO $$
BEGIN
  ALTER TABLE "Boost"
    ADD CONSTRAINT "Boost_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Boost"
    ADD CONSTRAINT "Boost_purchaserId_fkey"
    FOREIGN KEY ("purchaserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Boost"
    ADD CONSTRAINT "Boost_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ListingReport" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "details" TEXT,
  "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ListingReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ListingReport_listingId_createdAt_idx"
  ON "ListingReport"("listingId", "createdAt");
CREATE INDEX IF NOT EXISTS "ListingReport_reporterId_createdAt_idx"
  ON "ListingReport"("reporterId", "createdAt");
CREATE INDEX IF NOT EXISTS "ListingReport_status_createdAt_idx"
  ON "ListingReport"("status", "createdAt");

DO $$
BEGIN
  ALTER TABLE "ListingReport"
    ADD CONSTRAINT "ListingReport_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ListingReport"
    ADD CONSTRAINT "ListingReport_reporterId_fkey"
    FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MediaAsset" (
  "id" TEXT NOT NULL,
  "uploadedById" TEXT,
  "listingId" TEXT,
  "messageId" TEXT,
  "type" "MediaAssetType" NOT NULL DEFAULT 'IMAGE',
  "url" TEXT NOT NULL,
  "storageKey" TEXT,
  "mimeType" TEXT,
  "byteSize" INTEGER,
  "width" INTEGER,
  "height" INTEGER,
  "altText" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MediaAsset_uploadedById_createdAt_idx"
  ON "MediaAsset"("uploadedById", "createdAt");
CREATE INDEX IF NOT EXISTS "MediaAsset_listingId_createdAt_idx"
  ON "MediaAsset"("listingId", "createdAt");
CREATE INDEX IF NOT EXISTS "MediaAsset_messageId_createdAt_idx"
  ON "MediaAsset"("messageId", "createdAt");
CREATE INDEX IF NOT EXISTS "MediaAsset_type_createdAt_idx"
  ON "MediaAsset"("type", "createdAt");

DO $$
BEGIN
  ALTER TABLE "MediaAsset"
    ADD CONSTRAINT "MediaAsset_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "MediaAsset"
    ADD CONSTRAINT "MediaAsset_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "MediaAsset"
    ADD CONSTRAINT "MediaAsset_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "actorId" TEXT,
  "listingId" TEXT,
  "conversationId" TEXT,
  "messageId" TEXT,
  "transactionId" TEXT,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "metadata" JSONB,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_createdAt_idx"
  ON "Notification"("userId", "readAt", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_actorId_createdAt_idx"
  ON "Notification"("actorId", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_listingId_createdAt_idx"
  ON "Notification"("listingId", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_conversationId_createdAt_idx"
  ON "Notification"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_messageId_createdAt_idx"
  ON "Notification"("messageId", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_transactionId_createdAt_idx"
  ON "Notification"("transactionId", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_type_createdAt_idx"
  ON "Notification"("type", "createdAt");

DO $$
BEGIN
  ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
