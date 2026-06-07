CREATE TABLE IF NOT EXISTS "SavedListing" (
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedListing_pkey" PRIMARY KEY ("userId","listingId")
);

CREATE TABLE IF NOT EXISTS "ListingView" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "viewerId" TEXT,
    "boostId" TEXT,
    "source" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListingView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SavedListing_listingId_createdAt_idx" ON "SavedListing"("listingId", "createdAt");
CREATE INDEX IF NOT EXISTS "SavedListing_userId_createdAt_idx" ON "SavedListing"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ListingView_listingId_viewedAt_idx" ON "ListingView"("listingId", "viewedAt");
CREATE INDEX IF NOT EXISTS "ListingView_viewerId_viewedAt_idx" ON "ListingView"("viewerId", "viewedAt");
CREATE INDEX IF NOT EXISTS "ListingView_boostId_viewedAt_idx" ON "ListingView"("boostId", "viewedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SavedListing_userId_fkey'
  ) THEN
    ALTER TABLE "SavedListing" ADD CONSTRAINT "SavedListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SavedListing_listingId_fkey'
  ) THEN
    ALTER TABLE "SavedListing" ADD CONSTRAINT "SavedListing_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ListingView_listingId_fkey'
  ) THEN
    ALTER TABLE "ListingView" ADD CONSTRAINT "ListingView_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ListingView_viewerId_fkey'
  ) THEN
    ALTER TABLE "ListingView" ADD CONSTRAINT "ListingView_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ListingView_boostId_fkey'
  ) THEN
    ALTER TABLE "ListingView" ADD CONSTRAINT "ListingView_boostId_fkey" FOREIGN KEY ("boostId") REFERENCES "Boost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
