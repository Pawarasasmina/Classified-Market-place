CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'LISTING_CARD', 'OFFER', 'SYSTEM');
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

CREATE TABLE "Conversation" (
  "id" TEXT NOT NULL,
  "listingId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversationParticipant" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "unreadCount" INTEGER NOT NULL DEFAULT 0,
  "lastReadAt" TIMESTAMP(3),
  "mutedAt" TIMESTAMP(3),
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "type" "MessageType" NOT NULL DEFAULT 'TEXT',
  "encryptedBody" TEXT,
  "encryptedPayload" TEXT,
  "encryptionIv" TEXT NOT NULL,
  "encryptionAuthTag" TEXT NOT NULL,
  "listingId" TEXT,
  "offerAmount" DECIMAL(12,2),
  "offerCurrency" TEXT,
  "offerStatus" "OfferStatus",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessageReadReceipt" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageReadReceipt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Conversation_listingId_idx" ON "Conversation"("listingId");
CREATE INDEX "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");
CREATE INDEX "MessageReadReceipt_userId_idx" ON "MessageReadReceipt"("userId");
CREATE UNIQUE INDEX "MessageReadReceipt_messageId_userId_key" ON "MessageReadReceipt"("messageId", "userId");

ALTER TABLE "Conversation"
  ADD CONSTRAINT "Conversation_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConversationParticipant"
  ADD CONSTRAINT "ConversationParticipant_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationParticipant"
  ADD CONSTRAINT "ConversationParticipant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MessageReadReceipt"
  ADD CONSTRAINT "MessageReadReceipt_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageReadReceipt"
  ADD CONSTRAINT "MessageReadReceipt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
