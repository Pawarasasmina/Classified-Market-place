ALTER TABLE "AdvertisementBanner"
ADD COLUMN IF NOT EXISTS "layout" TEXT NOT NULL DEFAULT 'WIDE';

DROP INDEX IF EXISTS "AdvertisementBanner_placement_isActive_sortOrder_idx";

CREATE INDEX IF NOT EXISTS "AdvertisementBanner_placement_isActive_layout_sortOrder_idx"
ON "AdvertisementBanner"("placement", "isActive", "layout", "sortOrder");
