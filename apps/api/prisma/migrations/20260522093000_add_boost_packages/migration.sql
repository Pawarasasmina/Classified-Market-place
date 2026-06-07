CREATE TABLE "BoostPackage" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "placement" "BoostPlacement" NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'AED',
  "durationDays" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BoostPackage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BoostPackage_slug_key" ON "BoostPackage"("slug");
CREATE INDEX "BoostPackage_isActive_sortOrder_idx" ON "BoostPackage"("isActive", "sortOrder");
CREATE INDEX "BoostPackage_placement_isActive_idx" ON "BoostPackage"("placement", "isActive");

ALTER TABLE "Boost" ADD COLUMN "packageId" TEXT;
CREATE INDEX "Boost_packageId_idx" ON "Boost"("packageId");

ALTER TABLE "Boost"
ADD CONSTRAINT "Boost_packageId_fkey"
FOREIGN KEY ("packageId") REFERENCES "BoostPackage"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
