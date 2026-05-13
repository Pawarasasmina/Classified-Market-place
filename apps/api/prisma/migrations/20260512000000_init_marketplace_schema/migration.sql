-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'SOLD', 'REMOVED');

-- CreateEnum
CREATE TYPE "ConversationParticipantRole" AS ENUM ('BUYER', 'SELLER');

-- CreateEnum
CREATE TYPE "ListingReportReason" AS ENUM ('SPAM', 'FRAUD', 'OFFENSIVE', 'MISLEADING', 'PROHIBITED_ITEM', 'OTHER');

-- CreateEnum
CREATE TYPE "ListingReportStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('REPORT_CREATED', 'REPORT_UNDER_REVIEW', 'LISTING_APPROVED', 'LISTING_REJECTED', 'LISTING_REMOVED', 'REPORT_DISMISSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT NOT NULL DEFAULT 'Marketplace User',
    "password" TEXT,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "reputationScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "schemaDefinition" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "location" TEXT NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "attributes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sellerId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingMedia" (
    "id" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "listingId" TEXT NOT NULL,

    CONSTRAINT "ListingMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingReport" (
    "id" TEXT NOT NULL,
    "reason" "ListingReportReason" NOT NULL,
    "details" TEXT,
    "status" "ListingReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionAction" "ModerationActionType",
    "resolutionNote" TEXT,
    "listingId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,

    CONSTRAINT "ListingReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingModerationEvent" (
    "id" TEXT NOT NULL,
    "action" "ModerationActionType" NOT NULL,
    "notes" TEXT,
    "previousListingStatus" "ListingStatus",
    "nextListingStatus" "ListingStatus",
    "resultingReportStatus" "ListingReportStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "listingId" TEXT NOT NULL,
    "reportId" TEXT,
    "actorId" TEXT,

    CONSTRAINT "ListingModerationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "role" "ConversationParticipantRole" NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "readAt" TIMESTAMP(3),
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedListing" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,

    CONSTRAINT "SavedListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "query" TEXT NOT NULL DEFAULT '',
    "categorySlug" TEXT NOT NULL DEFAULT '',
    "sort" TEXT NOT NULL DEFAULT 'newest',
    "alertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneOtpChallenge" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "PhoneOtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Listing_sellerId_idx" ON "Listing"("sellerId");

-- CreateIndex
CREATE INDEX "Listing_categoryId_idx" ON "Listing"("categoryId");

-- CreateIndex
CREATE INDEX "Listing_status_idx" ON "Listing"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ListingMedia_storageKey_key" ON "ListingMedia"("storageKey");

-- CreateIndex
CREATE INDEX "ListingMedia_listingId_sortOrder_idx" ON "ListingMedia"("listingId", "sortOrder");

-- CreateIndex
CREATE INDEX "ListingMedia_listingId_isPrimary_idx" ON "ListingMedia"("listingId", "isPrimary");

-- CreateIndex
CREATE INDEX "ListingReport_listingId_status_createdAt_idx" ON "ListingReport"("listingId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ListingReport_reporterId_createdAt_idx" ON "ListingReport"("reporterId", "createdAt");

-- CreateIndex
CREATE INDEX "ListingReport_resolvedById_createdAt_idx" ON "ListingReport"("resolvedById", "createdAt");

-- CreateIndex
CREATE INDEX "ListingModerationEvent_listingId_createdAt_idx" ON "ListingModerationEvent"("listingId", "createdAt");

-- CreateIndex
CREATE INDEX "ListingModerationEvent_reportId_createdAt_idx" ON "ListingModerationEvent"("reportId", "createdAt");

-- CreateIndex
CREATE INDEX "ListingModerationEvent_actorId_createdAt_idx" ON "ListingModerationEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "Conversation_buyerId_updatedAt_idx" ON "Conversation"("buyerId", "updatedAt");

-- CreateIndex
CREATE INDEX "Conversation_sellerId_updatedAt_idx" ON "Conversation"("sellerId", "updatedAt");

-- CreateIndex
CREATE INDEX "Conversation_listingId_updatedAt_idx" ON "Conversation"("listingId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_listingId_buyerId_sellerId_key" ON "Conversation"("listingId", "buyerId", "sellerId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_updatedAt_idx" ON "ConversationParticipant"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ConversationParticipant_conversationId_role_idx" ON "ConversationParticipant"("conversationId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_createdAt_idx" ON "Message"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "SavedListing_userId_createdAt_idx" ON "SavedListing"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SavedListing_listingId_idx" ON "SavedListing"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedListing_userId_listingId_key" ON "SavedListing"("userId", "listingId");

-- CreateIndex
CREATE INDEX "SavedSearch_userId_updatedAt_idx" ON "SavedSearch"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedSearch_userId_query_categorySlug_sort_key" ON "SavedSearch"("userId", "query", "categorySlug", "sort");

-- CreateIndex
CREATE INDEX "PhoneOtpChallenge_userId_createdAt_idx" ON "PhoneOtpChallenge"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PhoneOtpChallenge_phone_createdAt_idx" ON "PhoneOtpChallenge"("phone", "createdAt");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingMedia" ADD CONSTRAINT "ListingMedia_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingReport" ADD CONSTRAINT "ListingReport_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingReport" ADD CONSTRAINT "ListingReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingReport" ADD CONSTRAINT "ListingReport_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingModerationEvent" ADD CONSTRAINT "ListingModerationEvent_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingModerationEvent" ADD CONSTRAINT "ListingModerationEvent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ListingReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingModerationEvent" ADD CONSTRAINT "ListingModerationEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedListing" ADD CONSTRAINT "SavedListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedListing" ADD CONSTRAINT "SavedListing_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneOtpChallenge" ADD CONSTRAINT "PhoneOtpChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
