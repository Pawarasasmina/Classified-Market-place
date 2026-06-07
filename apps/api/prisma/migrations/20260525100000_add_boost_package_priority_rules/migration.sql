ALTER TYPE "ListingPriorityRuleTarget" ADD VALUE IF NOT EXISTS 'BOOST_PACKAGE';

DROP INDEX IF EXISTS "ListingPriorityRule_target_key";

ALTER TABLE "ListingPriorityRule"
ADD COLUMN "boostPackageId" TEXT;

ALTER TABLE "ListingPriorityRule"
ADD CONSTRAINT "ListingPriorityRule_boostPackageId_fkey"
FOREIGN KEY ("boostPackageId") REFERENCES "BoostPackage"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ListingPriorityRule_boostPackageId_idx"
ON "ListingPriorityRule"("boostPackageId");

CREATE UNIQUE INDEX "ListingPriorityRule_general_target_key"
ON "ListingPriorityRule"("target")
WHERE "boostPackageId" IS NULL;

CREATE UNIQUE INDEX "ListingPriorityRule_target_boostPackageId_key"
ON "ListingPriorityRule"("target", "boostPackageId");
