ALTER TABLE "ListingImage"
  ADD COLUMN IF NOT EXISTS "mediaAssetId" TEXT;

CREATE INDEX IF NOT EXISTS "ListingImage_mediaAssetId_idx"
  ON "ListingImage"("mediaAssetId");

DO $$
BEGIN
  ALTER TABLE "ListingImage"
    ADD CONSTRAINT "ListingImage_mediaAssetId_fkey"
    FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
