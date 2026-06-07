ALTER TYPE "ListingPriorityRuleTarget" ADD VALUE IF NOT EXISTS 'SELLER_RATING';
ALTER TYPE "ListingPriorityRuleTarget" ADD VALUE IF NOT EXISTS 'MANUAL_PROMOTION';

ALTER TABLE "Listing"
ADD COLUMN "adminPriorityPromoted" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Listing_status_adminPriorityPromoted_adminPriorityExpiresAt_idx"
ON "Listing"("status", "adminPriorityPromoted", "adminPriorityExpiresAt");
