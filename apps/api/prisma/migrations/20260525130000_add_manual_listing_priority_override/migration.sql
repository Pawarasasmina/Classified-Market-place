ALTER TABLE "Listing"
ADD COLUMN "adminPriorityPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "adminPriorityScore" INTEGER,
ADD COLUMN "adminPriorityExpiresAt" TIMESTAMP(3);

CREATE INDEX "Listing_status_adminPriorityPinned_adminPriorityExpiresAt_idx"
ON "Listing"("status", "adminPriorityPinned", "adminPriorityExpiresAt");

CREATE INDEX "Listing_status_adminPriorityScore_adminPriorityExpiresAt_idx"
ON "Listing"("status", "adminPriorityScore", "adminPriorityExpiresAt");
