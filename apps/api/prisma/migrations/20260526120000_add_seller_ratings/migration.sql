ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RATING';

CREATE TABLE "SellerRating" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "raterId" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "stars" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SellerRating_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SellerRating_raterId_listingId_key"
ON "SellerRating"("raterId", "listingId");

CREATE INDEX "SellerRating_sellerId_createdAt_idx"
ON "SellerRating"("sellerId", "createdAt");

CREATE INDEX "SellerRating_listingId_createdAt_idx"
ON "SellerRating"("listingId", "createdAt");

ALTER TABLE "SellerRating"
ADD CONSTRAINT "SellerRating_sellerId_fkey"
FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SellerRating"
ADD CONSTRAINT "SellerRating_raterId_fkey"
FOREIGN KEY ("raterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SellerRating"
ADD CONSTRAINT "SellerRating_listingId_fkey"
FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
