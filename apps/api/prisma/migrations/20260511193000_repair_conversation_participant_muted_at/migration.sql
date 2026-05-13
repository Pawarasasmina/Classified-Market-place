ALTER TABLE "ConversationParticipant"
  ADD COLUMN IF NOT EXISTS "mutedAt" TIMESTAMP(3);
