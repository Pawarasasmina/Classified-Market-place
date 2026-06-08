DO $$
BEGIN
  CREATE TYPE "PhoneVerificationStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'VERIFIED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'ADMIN_CREDIT';
  ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'ADMIN_DEBIT';
  ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'LISTING_FEE_REFUND';
  ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'SELLER_LEVEL_UPGRADE';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "SellerProfileStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "VerifiedSellerStatus" AS ENUM ('NOT_REQUESTED', 'REQUESTED', 'VERIFIED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "SellerDocumentSubmissionStatus" AS ENUM ('REQUESTED', 'SUBMITTED', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "SellerPrivilegeTierCode" AS ENUM ('FREE', 'PREMIUM', 'VERIFIED', 'VIP');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "phoneVerificationStatus" "PhoneVerificationStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  ADD COLUMN IF NOT EXISTS "phoneVerificationRequestedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastFailedLoginAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

ALTER TABLE "RefreshToken"
  ADD COLUMN IF NOT EXISTS "deviceName" TEXT,
  ADD COLUMN IF NOT EXISTS "revokedReason" TEXT,
  ADD COLUMN IF NOT EXISTS "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "RefreshToken"
SET "lastUsedAt" = COALESCE("lastUsedAt", "createdAt")
WHERE "lastUsedAt" IS NULL;

ALTER TABLE "Listing"
  ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedById" TEXT,
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "boostedUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "boostPriority" INTEGER;

CREATE INDEX IF NOT EXISTS "Listing_reviewedById_reviewedAt_idx"
  ON "Listing"("reviewedById", "reviewedAt");
CREATE INDEX IF NOT EXISTS "Listing_status_boostedUntil_boostPriority_idx"
  ON "Listing"("status", "boostedUntil", "boostPriority");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Listing_reviewedById_fkey'
  ) THEN
    ALTER TABLE "Listing"
      ADD CONSTRAINT "Listing_reviewedById_fkey"
      FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "SellerPrivilegeTier" (
  "id" TEXT NOT NULL,
  "code" "SellerPrivilegeTierCode" NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "monthlyFreeListingLimit" INTEGER NOT NULL DEFAULT 0,
  "activeListingLimit" INTEGER,
  "pendingListingLimit" INTEGER,
  "paidListingFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "sellerLevelUpgradeFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'AED',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SellerPrivilegeTier_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SellerPrivilegeTier"
  ADD COLUMN IF NOT EXISTS "code" "SellerPrivilegeTierCode",
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "slug" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "monthlyFreeListingLimit" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "activeListingLimit" INTEGER,
  ADD COLUMN IF NOT EXISTS "pendingListingLimit" INTEGER,
  ADD COLUMN IF NOT EXISTS "paidListingFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "sellerLevelUpgradeFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'AED',
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "SellerPrivilegeTier_code_key"
  ON "SellerPrivilegeTier"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "SellerPrivilegeTier_slug_key"
  ON "SellerPrivilegeTier"("slug");
CREATE INDEX IF NOT EXISTS "SellerPrivilegeTier_isActive_sortOrder_idx"
  ON "SellerPrivilegeTier"("isActive", "sortOrder");

CREATE TABLE IF NOT EXISTS "SellerProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "SellerProfileStatus" NOT NULL DEFAULT 'DRAFT',
  "verifiedSellerStatus" "VerifiedSellerStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  "privilegeTierId" TEXT,
  "formDefinition" JSONB,
  "formAnswers" JSONB,
  "requestMetadata" JSONB,
  "reviewMetadata" JSONB,
  "reviewNotes" TEXT,
  "requestedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SellerProfile_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SellerProfile"
  ADD COLUMN IF NOT EXISTS "status" "SellerProfileStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "verifiedSellerStatus" "VerifiedSellerStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  ADD COLUMN IF NOT EXISTS "privilegeTierId" TEXT,
  ADD COLUMN IF NOT EXISTS "formDefinition" JSONB,
  ADD COLUMN IF NOT EXISTS "formAnswers" JSONB,
  ADD COLUMN IF NOT EXISTS "requestMetadata" JSONB,
  ADD COLUMN IF NOT EXISTS "reviewMetadata" JSONB,
  ADD COLUMN IF NOT EXISTS "reviewNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "requestedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedById" TEXT,
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "SellerProfile_userId_key"
  ON "SellerProfile"("userId");
CREATE INDEX IF NOT EXISTS "SellerProfile_status_createdAt_idx"
  ON "SellerProfile"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "SellerProfile_verifiedSellerStatus_createdAt_idx"
  ON "SellerProfile"("verifiedSellerStatus", "createdAt");
CREATE INDEX IF NOT EXISTS "SellerProfile_reviewedById_reviewedAt_idx"
  ON "SellerProfile"("reviewedById", "reviewedAt");
CREATE INDEX IF NOT EXISTS "SellerProfile_privilegeTierId_idx"
  ON "SellerProfile"("privilegeTierId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SellerProfile_userId_fkey'
  ) THEN
    ALTER TABLE "SellerProfile"
      ADD CONSTRAINT "SellerProfile_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SellerProfile_reviewedById_fkey'
  ) THEN
    ALTER TABLE "SellerProfile"
      ADD CONSTRAINT "SellerProfile_reviewedById_fkey"
      FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SellerProfile_privilegeTierId_fkey'
  ) THEN
    ALTER TABLE "SellerProfile"
      ADD CONSTRAINT "SellerProfile_privilegeTierId_fkey"
      FOREIGN KEY ("privilegeTierId") REFERENCES "SellerPrivilegeTier"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "SellerDocumentRequest" (
  "id" TEXT NOT NULL,
  "sellerProfileId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "formDefinition" JSONB,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SellerDocumentRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SellerDocumentRequest"
  ADD COLUMN IF NOT EXISTS "sellerProfileId" TEXT,
  ADD COLUMN IF NOT EXISTS "label" TEXT,
  ADD COLUMN IF NOT EXISTS "slug" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "isRequired" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "formDefinition" JSONB,
  ADD COLUMN IF NOT EXISTS "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "dueAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "SellerDocumentRequest_sellerProfileId_slug_key"
  ON "SellerDocumentRequest"("sellerProfileId", "slug");
CREATE INDEX IF NOT EXISTS "SellerDocumentRequest_requestedAt_idx"
  ON "SellerDocumentRequest"("requestedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SellerDocumentRequest_sellerProfileId_fkey'
  ) THEN
    ALTER TABLE "SellerDocumentRequest"
      ADD CONSTRAINT "SellerDocumentRequest_sellerProfileId_fkey"
      FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "SellerDocumentSubmission" (
  "id" TEXT NOT NULL,
  "sellerProfileId" TEXT NOT NULL,
  "requestId" TEXT,
  "submittedById" TEXT NOT NULL,
  "status" "SellerDocumentSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
  "answers" JSONB,
  "files" JSONB,
  "reviewMetadata" JSONB,
  "reviewNotes" TEXT,
  "rejectionReason" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SellerDocumentSubmission_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SellerDocumentSubmission"
  ADD COLUMN IF NOT EXISTS "sellerProfileId" TEXT,
  ADD COLUMN IF NOT EXISTS "requestId" TEXT,
  ADD COLUMN IF NOT EXISTS "submittedById" TEXT,
  ADD COLUMN IF NOT EXISTS "status" "SellerDocumentSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
  ADD COLUMN IF NOT EXISTS "answers" JSONB,
  ADD COLUMN IF NOT EXISTS "files" JSONB,
  ADD COLUMN IF NOT EXISTS "reviewMetadata" JSONB,
  ADD COLUMN IF NOT EXISTS "reviewNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedById" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "SellerDocumentSubmission_sellerProfileId_submittedAt_idx"
  ON "SellerDocumentSubmission"("sellerProfileId", "submittedAt");
CREATE INDEX IF NOT EXISTS "SellerDocumentSubmission_requestId_submittedAt_idx"
  ON "SellerDocumentSubmission"("requestId", "submittedAt");
CREATE INDEX IF NOT EXISTS "SellerDocumentSubmission_status_submittedAt_idx"
  ON "SellerDocumentSubmission"("status", "submittedAt");
CREATE INDEX IF NOT EXISTS "SellerDocumentSubmission_reviewedById_reviewedAt_idx"
  ON "SellerDocumentSubmission"("reviewedById", "reviewedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SellerDocumentSubmission_sellerProfileId_fkey'
  ) THEN
    ALTER TABLE "SellerDocumentSubmission"
      ADD CONSTRAINT "SellerDocumentSubmission_sellerProfileId_fkey"
      FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SellerDocumentSubmission_requestId_fkey'
  ) THEN
    ALTER TABLE "SellerDocumentSubmission"
      ADD CONSTRAINT "SellerDocumentSubmission_requestId_fkey"
      FOREIGN KEY ("requestId") REFERENCES "SellerDocumentRequest"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SellerDocumentSubmission_submittedById_fkey'
  ) THEN
    ALTER TABLE "SellerDocumentSubmission"
      ADD CONSTRAINT "SellerDocumentSubmission_submittedById_fkey"
      FOREIGN KEY ("submittedById") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SellerDocumentSubmission_reviewedById_fkey'
  ) THEN
    ALTER TABLE "SellerDocumentSubmission"
      ADD CONSTRAINT "SellerDocumentSubmission_reviewedById_fkey"
      FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "SellerPrivilegeCategoryQuota" (
  "id" TEXT NOT NULL,
  "sellerPrivilegeTierId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "monthlyFreeListingLimit" INTEGER,
  "activeListingLimit" INTEGER,
  "pendingListingLimit" INTEGER,
  "paidListingFee" DECIMAL(12,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SellerPrivilegeCategoryQuota_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SellerPrivilegeCategoryQuota"
  ADD COLUMN IF NOT EXISTS "sellerPrivilegeTierId" TEXT,
  ADD COLUMN IF NOT EXISTS "categoryId" TEXT,
  ADD COLUMN IF NOT EXISTS "monthlyFreeListingLimit" INTEGER,
  ADD COLUMN IF NOT EXISTS "activeListingLimit" INTEGER,
  ADD COLUMN IF NOT EXISTS "pendingListingLimit" INTEGER,
  ADD COLUMN IF NOT EXISTS "paidListingFee" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "SellerPrivilegeCategoryQuota_sellerPrivilegeTierId_categoryId_key"
  ON "SellerPrivilegeCategoryQuota"("sellerPrivilegeTierId", "categoryId");
CREATE INDEX IF NOT EXISTS "SellerPrivilegeCategoryQuota_categoryId_idx"
  ON "SellerPrivilegeCategoryQuota"("categoryId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SellerPrivilegeCategoryQuota_sellerPrivilegeTierId_fkey'
  ) THEN
    ALTER TABLE "SellerPrivilegeCategoryQuota"
      ADD CONSTRAINT "SellerPrivilegeCategoryQuota_sellerPrivilegeTierId_fkey"
      FOREIGN KEY ("sellerPrivilegeTierId") REFERENCES "SellerPrivilegeTier"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SellerPrivilegeCategoryQuota_categoryId_fkey'
  ) THEN
    ALTER TABLE "SellerPrivilegeCategoryQuota"
      ADD CONSTRAINT "SellerPrivilegeCategoryQuota_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "SellerBadgeType" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "icon" TEXT,
  "style" JSONB,
  "backgroundColor" TEXT,
  "textColor" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isHidden" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SellerBadgeType_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SellerBadgeType"
  ADD COLUMN IF NOT EXISTS "label" TEXT,
  ADD COLUMN IF NOT EXISTS "slug" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "icon" TEXT,
  ADD COLUMN IF NOT EXISTS "style" JSONB,
  ADD COLUMN IF NOT EXISTS "backgroundColor" TEXT,
  ADD COLUMN IF NOT EXISTS "textColor" TEXT,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "SellerBadgeType_slug_key"
  ON "SellerBadgeType"("slug");
CREATE INDEX IF NOT EXISTS "SellerBadgeType_isActive_isHidden_sortOrder_idx"
  ON "SellerBadgeType"("isActive", "isHidden", "sortOrder");

CREATE TABLE IF NOT EXISTS "SellerBadgeAssignment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sellerProfileId" TEXT,
  "badgeTypeId" TEXT NOT NULL,
  "assignedById" TEXT,
  "metadata" JSONB,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),

  CONSTRAINT "SellerBadgeAssignment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SellerBadgeAssignment"
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "sellerProfileId" TEXT,
  ADD COLUMN IF NOT EXISTS "badgeTypeId" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedById" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB,
  ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "SellerBadgeAssignment_userId_badgeTypeId_key"
  ON "SellerBadgeAssignment"("userId", "badgeTypeId");
CREATE INDEX IF NOT EXISTS "SellerBadgeAssignment_badgeTypeId_assignedAt_idx"
  ON "SellerBadgeAssignment"("badgeTypeId", "assignedAt");
CREATE INDEX IF NOT EXISTS "SellerBadgeAssignment_sellerProfileId_assignedAt_idx"
  ON "SellerBadgeAssignment"("sellerProfileId", "assignedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SellerBadgeAssignment_userId_fkey'
  ) THEN
    ALTER TABLE "SellerBadgeAssignment"
      ADD CONSTRAINT "SellerBadgeAssignment_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SellerBadgeAssignment_sellerProfileId_fkey'
  ) THEN
    ALTER TABLE "SellerBadgeAssignment"
      ADD CONSTRAINT "SellerBadgeAssignment_sellerProfileId_fkey"
      FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SellerBadgeAssignment_badgeTypeId_fkey'
  ) THEN
    ALTER TABLE "SellerBadgeAssignment"
      ADD CONSTRAINT "SellerBadgeAssignment_badgeTypeId_fkey"
      FOREIGN KEY ("badgeTypeId") REFERENCES "SellerBadgeType"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SellerBadgeAssignment_assignedById_fkey'
  ) THEN
    ALTER TABLE "SellerBadgeAssignment"
      ADD CONSTRAINT "SellerBadgeAssignment_assignedById_fkey"
      FOREIGN KEY ("assignedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
