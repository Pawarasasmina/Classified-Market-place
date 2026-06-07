CREATE TABLE "BoostPackageCategory" (
  "boostPackageId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BoostPackageCategory_pkey" PRIMARY KEY ("boostPackageId", "categoryId")
);

CREATE INDEX "BoostPackageCategory_categoryId_idx" ON "BoostPackageCategory"("categoryId");

ALTER TABLE "BoostPackageCategory"
ADD CONSTRAINT "BoostPackageCategory_boostPackageId_fkey"
FOREIGN KEY ("boostPackageId") REFERENCES "BoostPackage"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BoostPackageCategory"
ADD CONSTRAINT "BoostPackageCategory_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
