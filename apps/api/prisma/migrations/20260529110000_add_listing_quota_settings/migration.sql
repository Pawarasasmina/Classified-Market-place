CREATE TYPE "ListingPaymentMode" AS ENUM ('FREE', 'PAID');

ALTER TABLE "Listing"
ADD COLUMN "listingPaymentMode" "ListingPaymentMode" NOT NULL DEFAULT 'FREE';

CREATE TABLE "MarketplaceSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceSetting_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "Listing_sellerId_listingPaymentMode_status_idx"
ON "Listing"("sellerId", "listingPaymentMode", "status");
