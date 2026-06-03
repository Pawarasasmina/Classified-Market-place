ALTER TYPE "ListingPriorityRuleTarget" RENAME VALUE 'CATEGORY_LISTING' TO 'CATEGORY_PRIORITY';
ALTER TYPE "ListingPriorityRuleTarget" RENAME VALUE 'MANUAL_PROMOTION' TO 'MANUAL_ADMIN_PRIORITY';

ALTER TABLE "Listing"
ADD COLUMN "paidPriorityEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "adminPriorityStartsAt" TIMESTAMP(3);

UPDATE "Listing" AS listing
SET "paidPriorityEnabled" = true
WHERE EXISTS (
  SELECT 1
  FROM "Transaction" AS transaction
  WHERE transaction."listingId" = listing."id"
    AND transaction."type" = 'LISTING_FEE'
    AND transaction."status" = 'SUCCEEDED'
);

DROP INDEX IF EXISTS "Listing_status_adminPriorityPromoted_adminPriorityExpiresAt_idx";
DROP INDEX IF EXISTS "Listing_status_adminPriorityPinned_adminPriorityExpiresAt_idx";
DROP INDEX IF EXISTS "Listing_status_adminPriorityScore_adminPriorityExpiresAt_idx";

CREATE INDEX "Listing_status_paidPriorityEnabled_idx"
ON "Listing"("status", "paidPriorityEnabled");

CREATE INDEX "Listing_status_adminPriorityPromoted_adminPriorityStartsAt_adminPriorityExpiresAt_idx"
ON "Listing"("status", "adminPriorityPromoted", "adminPriorityStartsAt", "adminPriorityExpiresAt");

CREATE INDEX "Listing_status_adminPriorityPinned_adminPriorityStartsAt_adminPriorityExpiresAt_idx"
ON "Listing"("status", "adminPriorityPinned", "adminPriorityStartsAt", "adminPriorityExpiresAt");

CREATE INDEX "Listing_status_adminPriorityScore_adminPriorityStartsAt_adminPriorityExpiresAt_idx"
ON "Listing"("status", "adminPriorityScore", "adminPriorityStartsAt", "adminPriorityExpiresAt");
