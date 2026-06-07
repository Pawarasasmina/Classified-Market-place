CREATE TYPE "SellerPriorityTier" AS ENUM ('NONE', 'AUTHORIZED', 'VERIFIED', 'VIP');

CREATE TYPE "ListingPriorityRuleTarget" AS ENUM (
  'BOOSTED_LISTING',
  'AUTHORIZED_SELLER',
  'VERIFIED_SELLER',
  'VIP_SELLER'
);

ALTER TABLE "User"
ADD COLUMN "sellerPriorityTier" "SellerPriorityTier" NOT NULL DEFAULT 'NONE';

CREATE TABLE "ListingPriorityRule" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "target" "ListingPriorityRuleTarget" NOT NULL,
  "weight" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ListingPriorityRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ListingPriorityRule_isActive_sortOrder_idx" ON "ListingPriorityRule"("isActive", "sortOrder");
CREATE INDEX "ListingPriorityRule_target_isActive_idx" ON "ListingPriorityRule"("target", "isActive");
CREATE UNIQUE INDEX "ListingPriorityRule_target_key" ON "ListingPriorityRule"("target");
