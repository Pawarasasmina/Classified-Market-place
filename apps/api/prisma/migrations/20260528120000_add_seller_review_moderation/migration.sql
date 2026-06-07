CREATE TYPE "SellerReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "SellerRating"
ADD COLUMN "reviewStatus" "SellerReviewStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN "reviewModerationNote" TEXT,
ADD COLUMN "reviewModeratedAt" TIMESTAMP(3),
ADD COLUMN "reviewModeratedById" TEXT;

ALTER TABLE "SellerRating"
ALTER COLUMN "reviewStatus" SET DEFAULT 'PENDING';

CREATE INDEX "SellerRating_reviewStatus_updatedAt_idx"
ON "SellerRating"("reviewStatus", "updatedAt");
