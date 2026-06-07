ALTER TYPE "ListingPriorityRuleTarget" ADD VALUE IF NOT EXISTS 'CATEGORY_LISTING';

DROP INDEX IF EXISTS "ListingPriorityRule_general_target_key";
DROP INDEX IF EXISTS "ListingPriorityRule_target_boostPackageId_key";

ALTER TABLE "ListingPriorityRule"
ADD COLUMN "categoryId" TEXT;

ALTER TABLE "ListingPriorityRule"
ADD CONSTRAINT "ListingPriorityRule_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ListingPriorityRule_categoryId_idx"
ON "ListingPriorityRule"("categoryId");

CREATE UNIQUE INDEX "ListingPriorityRule_general_target_key"
ON "ListingPriorityRule"("target")
WHERE "boostPackageId" IS NULL AND "categoryId" IS NULL;

CREATE UNIQUE INDEX "ListingPriorityRule_boost_package_scope_key"
ON "ListingPriorityRule"("target", "boostPackageId")
WHERE "boostPackageId" IS NOT NULL AND "categoryId" IS NULL;

CREATE UNIQUE INDEX "ListingPriorityRule_category_scope_key"
ON "ListingPriorityRule"("target", "categoryId")
WHERE "categoryId" IS NOT NULL AND "boostPackageId" IS NULL;
