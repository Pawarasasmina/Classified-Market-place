ALTER TABLE "Category"
ADD COLUMN "listingExpiryDays" INTEGER NOT NULL DEFAULT 30;

UPDATE "Category"
SET "listingExpiryDays" = 60
WHERE "slug" IN ('property', 'apartments');

ALTER TABLE "Listing"
ADD COLUMN "clientDraftKey" TEXT,
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "soldAt" TIMESTAMP(3),
ADD COLUMN "removedAt" TIMESTAMP(3);

CREATE INDEX "Listing_expiresAt_idx" ON "Listing"("expiresAt");
CREATE UNIQUE INDEX "Listing_sellerId_clientDraftKey_key" ON "Listing"("sellerId", "clientDraftKey");
