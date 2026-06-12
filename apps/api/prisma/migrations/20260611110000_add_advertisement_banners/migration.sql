CREATE TABLE IF NOT EXISTS "AdvertisementBanner" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "kicker" TEXT,
  "body" TEXT,
  "imageUrl" TEXT NOT NULL,
  "imageAlt" TEXT,
  "badgeLabel" TEXT,
  "metricValue" TEXT,
  "metricLabel" TEXT,
  "ctaLabel" TEXT,
  "ctaHref" TEXT,
  "secondaryCtaLabel" TEXT,
  "secondaryCtaHref" TEXT,
  "placement" TEXT NOT NULL DEFAULT 'HOME',
  "backgroundColor" TEXT,
  "textColor" TEXT,
  "accentColor" TEXT,
  "rotationSeconds" INTEGER NOT NULL DEFAULT 6,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdvertisementBanner_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdvertisementBanner_placement_isActive_sortOrder_idx"
ON "AdvertisementBanner"("placement", "isActive", "sortOrder");

CREATE INDEX IF NOT EXISTS "AdvertisementBanner_startsAt_endsAt_idx"
ON "AdvertisementBanner"("startsAt", "endsAt");
