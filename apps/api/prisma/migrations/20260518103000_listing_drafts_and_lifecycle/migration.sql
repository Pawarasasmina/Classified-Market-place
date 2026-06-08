ALTER TABLE "Category"
ADD COLUMN IF NOT EXISTS "listingExpiryDays" INTEGER NOT NULL DEFAULT 30;

UPDATE "Category"
SET "listingExpiryDays" = 60
WHERE "slug" IN ('property', 'apartments');

ALTER TABLE "Listing"
ADD COLUMN IF NOT EXISTS "clientDraftKey" TEXT,
ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "soldAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "removedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Listing_expiresAt_idx" ON "Listing"("expiresAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Listing_sellerId_clientDraftKey_key" ON "Listing"("sellerId", "clientDraftKey");
